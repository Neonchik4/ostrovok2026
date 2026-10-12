import asyncio
import json
from typing import AsyncGenerator, Dict
from ..schemas.chat import (
    ChatStreamRequest,
    ThoughtEvent,
    TokenEvent,
    WidgetEvent,
    ExtractedSlots
)
from ..services.llm_cascade import (
    extract_slots_cascade,
    think_stream,
    generate_concierge_response_stream,
)
from ..services.session_memory import session_memory, merge_slots
from ..services.hotel_search_adapter import search_hotels_unified

async def run_agent_workflow(req: ChatStreamRequest) -> AsyncGenerator[str, None]:
    """
    Потоковый генератор Server-Sent Events (SSE).
    Генерирует события:
    - event: thought
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
        # Мгновенно отдаем первый шаг мыслей агента
        yield _format_sse("thought", {"step": "reasoning", "text": "Оцениваю параметры запроса и формирую критерии поиска... "})

        # Запускаем извлечение слотов параллельно в фоновой задаче
        slots_task = asyncio.create_task(extract_slots_cascade(message))

        # Потоковый ход рассуждений агента (Thinking Process)
        async for chunk in think_stream(message):
            yield _format_sse("thought", {"step": "reasoning", "text": chunk})

        # Дожидаемся результатов извлечения слотов и объединяем с контекстом диалога (Multi-turn Slot Merging)
        new_slots: ExtractedSlots = await slots_task
        if req.nights and req.nights != 2:
            new_slots.nights = req.nights
        if req.guests and req.guests != 2:
            new_slots.guests_count = req.guests
        if req.pets and req.pets > 0:
            new_slots.pet_friendly = True

        slots: ExtractedSlots = merge_slots(prev_slots, new_slots)
        session_memory.save_slots(conv_id, slots)

        city_label = slots.city or "выбранном регионе"

        # 2. Шаг рассуждения: Применение фильтров
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
        
        filters_text = (
            f"Применяю фильтры: {', '.join(active_filters)}"
            if active_filters else
            "Дополнительные фильтры не заданы — ранжирую по рейтингу и популярности"
        )
        yield _format_sse("thought", {"step": "filtering", "text": filters_text})
        await asyncio.sleep(0.6)

        # 3. Шаг: Векторный поиск
        yield _format_sse("thought", {"step": "hybrid_search", "text": f"Векторный поиск релевантных вариантов в {city_label}..."})
        hotels = await search_hotels_unified(slots)
        await asyncio.sleep(0.6)
        
        # 4. Итог поиска с прозрачной статистикой
        if hotels:
            top_score = hotels[0].match_score_pct
            min_cost = min(h.min_price_per_night_rub for h in hotels)
            if slots.max_price_per_night_rub and min_cost > slots.max_price_per_night_rub:
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
        await asyncio.sleep(0.6)

        # 5. Шаг рассуждения: Детерминированный расчет чека
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
                "text": f"Рассчитываю прозрачные чеки и проверяю правила отмены..."
            })
        await asyncio.sleep(0.6)

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
    pluralize_nights as _pluralize_nights,
    pluralize_hotels as _pluralize_hotels,
)


def _format_sse(event_type: str, data: Dict[str, object]) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
