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
from ..services.llm_cascade import extract_slots_cascade, think_stream
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
    message = req.message.strip()
    if req.disambiguation_selection:
        sel = req.disambiguation_selection.strip()
        if not message or message.lower() == sel.lower():
            message = sel
        elif sel.lower() not in message.lower():
            message = f"{message}. Уточнение: {sel}"
        
    try:
        # Извлекаем слоты для детерминированного контроля параметров
        slots: ExtractedSlots = await extract_slots_cascade(message)
        if req.nights:
            slots.nights = req.nights
        if req.guests:
            slots.guests_count = req.guests
        if req.pets:
            slots.pet_friendly = req.pets > 0

        # 1. Потоковый ход рассуждений агента (Thinking Process)
        async for chunk in think_stream(message, slots):
            yield _format_sse("thought", {"step": "reasoning", "text": chunk})

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
        await asyncio.sleep(0.1)

        # 3. Шаг: Векторный поиск
        yield _format_sse("thought", {"step": "hybrid_search", "text": f"Векторный поиск релевантных вариантов в {city_label}..."})
        hotels = await search_hotels_unified(slots)
        await asyncio.sleep(0.1)
        
        # 4. Итог поиска с прозрачной статистикой
        if hotels:
            top_score = hotels[0].match_score_pct
            min_cost = min(h.min_price_per_night_rub for h in hotels)
            yield _format_sse("thought", {
                "step": "results",
                "text": f"Найдено {len(hotels)} {_pluralize_hotels(len(hotels))}, лучший Match Score: {top_score}%, цены от {min_cost:,} ₽/ночь".replace(",", " ")
            })
        else:
            yield _format_sse("thought", {
                "step": "results",
                "text": f"Отели по строгому запросу не найдены в {city_label}, предлагаю скорректировать фильтры"
            })
        await asyncio.sleep(0.1)

        # 5. Шаг рассуждения: Детерминированный расчет чека
        if hotels and hotels[0].receipt:
            top_h = hotels[0]
            top_rec = top_h.receipt
            yield _format_sse("thought", {
                "step": "receipt_calculation",
                "text": f"Прозрачный чек для «{top_h.name}»: {top_rec.nights} {_pluralize_nights(top_rec.nights)} × {top_rec.price_per_night_rub:,} ₽ = {top_rec.total_rub:,} ₽ без скрытых комиссий".replace(",", " ")
            })
        else:
            yield _format_sse("thought", {
                "step": "receipt_calculation",
                "text": f"Рассчитываю прозрачные чеки и проверяю правила отмены для {len(hotels)} {_pluralize_hotels(len(hotels))}..."
            })
        await asyncio.sleep(0.1)


        # 5. Стриминг текста ответа (event: token)
        intro_text = (
            f"Я нашел {len(hotels)} {_pluralize_hotels(len(hotels))} в {city_label}, максимально подходящих под ваши критерии. "
            f"Каждая карточка содержит прозрачный расчет стоимости на {slots.nights or 2} {_pluralize_nights(slots.nights or 2)} без скрытых комиссий."
        )
        
        words = intro_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield _format_sse("token", {"content": chunk})
            await asyncio.sleep(0.02)
            
        # 6. Стриминг виджета (event: widget)
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
        
        # 7. Финализация
        yield _format_sse("done", {"status": "ok"})
        
    except Exception as e:
        yield _format_sse("thought", {"step": "error", "text": f"Ошибка обработки: {str(e)}"})
        yield _format_sse("token", {"content": "Произошла ошибка при поиске отелей. Пожалуйста, попробуйте изменить запрос."})
        yield _format_sse("done", {"status": "error", "error": str(e)})

def _pluralize_guests(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return "гость"
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return "гостя"
    return "гостей"

def _pluralize_nights(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return "ночь"
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return "ночи"
    return "ночей"

def _pluralize_hotels(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return "отель"
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return "отеля"
    return "отелей"


def _format_sse(event_type: str, data: Dict[str, object]) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
