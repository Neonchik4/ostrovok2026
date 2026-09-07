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
from ..services.llm_cascade import extract_slots_cascade
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
        message = f"{message}. Уточнение: {req.disambiguation_selection}"
        
    try:
        # 1. Шаг рассуждения: Анализ слотов
        yield _format_sse("thought", {"step": "slot_extraction", "text": "Анализирую параметры запроса: локация, даты, гости, питомцы..."})
        await asyncio.sleep(0.3)
        
        slots: ExtractedSlots = await extract_slots_cascade(message)
        if req.nights:
            slots.nights = req.nights
        if req.guests:
            slots.guests_count = req.guests
        if req.pets:
            slots.pet_friendly = req.pets > 0

        # 2. Шаг рассуждения: Поиск отелей
        city_label = slots.city or "выбранном регионе"
        yield _format_sse("thought", {"step": "hybrid_search", "text": f"Выполняю гибридный векторный поиск отелей в {city_label}..."})
        await asyncio.sleep(0.3)
        
        hotels = await search_hotels_unified(slots)
        
        # 3. Шаг рассуждения: Детерминированный расчет чека
        yield _format_sse("thought", {"step": "receipt_calculation", "text": f"Рассчитываю прозрачные чеки и проверяю правила отмены для {len(hotels)} отелей..."})
        await asyncio.sleep(0.2)

        # 4. Стриминг текста ответа (event: token)
        intro_text = (
            f"Я нашел {len(hotels)} отелей в {city_label}, максимально подходящих под ваши критерии. "
            f"Каждая карточка содержит прозрачный расчет стоимости на {slots.nights or 2} ночи без скрытых комиссий."
        )
        
        words = intro_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield _format_sse("token", {"content": chunk})
            await asyncio.sleep(0.02)
            
        # 5. Стриминг виджета (event: widget)
        widget_payload = {
            "type": "hotel_grid",
            "hotels": [h.model_dump() for h in hotels],
            "disambiguation_chips": slots.disambiguation_suggestions or [
                "Только с завтраком",
                "С подогреваемым бассейном",
                "Дешевле 10 000 ₽"
            ]
        }
        yield _format_sse("widget", widget_payload)
        
        # 6. Финализация
        yield _format_sse("done", {"status": "ok"})
        
    except Exception as e:
        yield _format_sse("thought", {"step": "error", "text": f"Ошибка обработки: {str(e)}"})
        yield _format_sse("token", {"content": "Произошла ошибка при поиске отелей. Пожалуйста, попробуйте изменить запрос."})
        yield _format_sse("done", {"status": "error", "error": str(e)})

def _format_sse(event_type: str, data: Dict[str, object]) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
