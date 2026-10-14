import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

from ..schemas.chat import ChatStreamRequest, ExtractedSlots
from ..services.hotel_search_adapter import search_hotels_with_telemetry
from ..services.llm_cascade import (
    build_deterministic_reasoning,
    extract_slots_cascade,
    generate_concierge_response_stream,
)
from ..services.session_memory import merge_slots, session_memory


async def run_agent_workflow(req: ChatStreamRequest) -> AsyncGenerator[str, None]:
    """
    Потоковый генератор Server-Sent Events (SSE).
    Генерирует детерминированную телеметрию пайплайна:
    - event: thought (reasoning -> filtering -> hybrid_search -> results -> receipt_calculation)
    - event: token
    - event: widget
    - event: done
    """
    conv_id = req.conversation_id or "default_session"
    prev_slots = session_memory.get_slots(conv_id)

    message = req.message.strip()
    if req.disambiguation_selection:
        sel = req.disambiguation_selection.strip()
        if not message or message.lower() == sel.lower():
            message = sel
        elif sel.lower() not in message.lower():
            message = f"{message}. Уточнение: {sel}"
        
    try:
        # 1. Мгновенная индикация начала обработки (< 50 мс для исключения зависаний)
        yield _format_sse("thought", {"step": "reasoning", "text": "Оцениваю параметры запроса и формирую критерии поиска..."})

        # Извлечение интентов и слотов через каскад (Gemini 2.5 Flash / Flash Lite -> локальный экстрактор)
        new_slots: ExtractedSlots = await extract_slots_cascade(message)
        if req.nights and req.nights != 2:
            new_slots.nights = req.nights
        if req.guests and req.guests != 2:
            new_slots.guests_count = req.guests
        if req.pets and req.pets > 0:
            new_slots.pet_friendly = True

        slots: ExtractedSlots = merge_slots(prev_slots, new_slots)
        session_memory.save_slots(conv_id, slots)

        city_label = slots.city or "выбранном регионе"

        # Детерминированное рассуждение на базе реального запроса и извлеченных слотов
        reasoning_text = build_deterministic_reasoning(message, slots)
        yield _format_sse("thought", {"step": "reasoning", "text": reasoning_text})
        await asyncio.sleep(0.2)

        # 2. Выполняем поиск отелей с получением реальной телеметрии базы
        hotels, telemetry = await search_hotels_with_telemetry(slots)

        # 3. Шаг рассуждения: Применение фильтров и скалярная статистика
        active_filters = []
        if slots.stars:
            active_filters.append(f"от {slots.stars}★")
        if slots.max_price_per_night_rub:
            active_filters.append(f"до {slots.max_price_per_night_rub:,} ₽/ночь".replace(",", " "))
        if slots.heated_pool:
            active_filters.append("теплый бассейн")
        if slots.spa:
            active_filters.append("СПА-комплекс")
        if slots.breakfast_included:
            active_filters.append("завтрак включён")
        if slots.free_cancellation:
            active_filters.append("свободная отмена")
        if slots.pet_friendly:
            active_filters.append("с питомцем")
        
        if active_filters:
            filters_text = (
                f"Скалярная фильтрация: проверено {telemetry.total_evaluated} отелей "
                f"({telemetry.total_in_region} в {city_label}) -> "
                f"{telemetry.scalar_matched} строго соответствуют критериям ({', '.join(active_filters)})"
            )
        else:
            filters_text = f"Каталог {city_label}: доступно {telemetry.total_in_region} отелей, ранжирую по рейтингу и отзывам"

        yield _format_sse("thought", {"step": "filtering", "text": filters_text})
        await asyncio.sleep(0.2)

        # 4. Шаг: Векторный гибридный поиск
        yield _format_sse("thought", {
            "step": "hybrid_search",
            "text": f"Векторный поиск ({telemetry.engine}): ранжирование кандидатов по косинусному сходству и отзывам гостей..."
        })
        await asyncio.sleep(0.2)
        
        # 5. Итог поиска с прозрачной статистикой
        if hotels:
            top_score = telemetry.top_score_pct or hotels[0].match_score_pct
            min_cost = telemetry.min_price_rub or min(h.min_price_per_night_rub for h in hotels)
            if telemetry.is_relaxed:
                yield _format_sse("thought", {
                    "step": "results",
                    "text": f"В рамках бюджета до {slots.max_price_per_night_rub:,} ₽ отелей в {city_label} нет (минимальный тариф от {min_cost:,} ₽). Отобрал {len(hotels)} {_pluralize_hotels(len(hotels))} с наилучшим соотношением цены и качества".replace(",", " ")
                })
            else:
                yield _format_sse("thought", {
                    "step": "results",
                    "text": f"Найдено {len(hotels)} {_pluralize_hotels(len(hotels))}, лучший Match Score: {top_score}%, цены от {min_cost:,} ₽/ночь".replace(",", " ")
                })
        else:
            yield _format_sse("thought", {
                "step": "results",
                "text": f"Отели по строгому запросу не найдены в {city_label}, предлагаю скорректировать фильтры"
            })
        await asyncio.sleep(0.2)

        # 6. Шаг рассуждения: Детерминированный расчет чека
        top_receipt = hotels[0].receipt if hotels else None
        if hotels and top_receipt is not None:
            top_h = hotels[0]
            top_rec = top_receipt
            yield _format_sse("thought", {
                "step": "receipt_calculation",
                "text": f"Прозрачный чек для «{top_h.name}»: {top_rec.nights} {_pluralize_nights(top_rec.nights)} × {top_rec.price_per_night_rub:,} ₽ = {top_rec.total_rub:,} ₽ без скрытых комиссий".replace(",", " ")
            })
        else:
            yield _format_sse("thought", {
                "step": "receipt_calculation",
                "text": "Рассчитываю прозрачные чеки и проверяю правила отмены..."
            })
        await asyncio.sleep(0.2)

        # 6. Стриминг текста ответа агента (Real LLM, без шаблонных повторов)
        async for chunk in generate_concierge_response_stream(message, slots, hotels):
            yield _format_sse("token", {"content": chunk})
            
        # 7. Стриминг виджета (event: widget)
        widget_payload = {
            "type": "hotel_grid",
            "hotels": [h.model_dump() for h in hotels],
            "disambiguation_chips": slots.disambiguation_suggestions or [
                "Только с завтраком",
                "С теплым бассейном",
                "До 10 000 ₽ / ночь",
                "Свободная отмена",
            ]
        }
        yield _format_sse("widget", widget_payload)
        
        # 8. Финализация
        yield _format_sse("done", {"status": "ok"})
        
    except Exception as e:
        yield _format_sse("thought", {"step": "error", "text": f"Ошибка обработки: {str(e)}"})
        yield _format_sse("token", {"content": "Произошла ошибка при поиске отелей. Пожалуйста, попробуйте изменить запрос."})
        yield _format_sse("done", {"status": "error", "error": str(e)})

from ..services.text_helpers import (
    pluralize_guests as _pluralize_guests,
)
from ..services.text_helpers import (
    pluralize_hotels as _pluralize_hotels,
)
from ..services.text_helpers import (
    pluralize_nights as _pluralize_nights,
)


def _format_sse(event_type: str, data: dict[str, Any]) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


__all__ = [
    "run_agent_workflow",
    "_format_sse",
    "_pluralize_guests",
    "_pluralize_hotels",
    "_pluralize_nights",
]

