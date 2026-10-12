import asyncio
from typing import AsyncGenerator, List, Any
from ..config import settings
from ..schemas.chat import ExtractedSlots
from .text_helpers import sanitize_user_input
from .llm_client import stream_gemini_content

SYSTEM_CONCIERGE_PROMPT = """Ты — персональный AI-агент сервиса бронирования отелей «Островок».
Твоя задача — дать живой, тёплый, профессиональный ответ пользователю по найденным отелям.

Правила:
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать шаблонные клише («Я нашел 6 отелей в выбранном регионе...»). Говори живым человеческим языком.
2. Обратись к запросу пользователя: подтверди город, звездность, бюджет или удобства (спа, бассейн, питомцы, бесплатная отмена).
3. Назови 1-2 конкретных отеля из предоставленного списка, отметь их ключевые преимущества.
4. Ответ должен быть ёмким: 2-3 связных предложения. Не выдумывай отели, которых нет в списке.
"""

def build_deterministic_concierge_response(user_message: str, slots: ExtractedSlots, hotels: List[Any]) -> str:
    """
    Формирует качественный детерминированный диалоговый ответ агента.
    """
    if not hotels:
        city = slots.city or "выбранном направлении"
        return f"По вашему запросу отели в {city} не найдены. Попробуйте скорректировать фильтры или расширить ценовой диапазон."

    city = slots.city or getattr(hotels[0], "city", "выбранном регионе")
    count = len(hotels)
    min_cost = min((getattr(h, "min_price_per_night_rub", 0) for h in hotels), default=0)
    top_names = [f"«{getattr(h, 'name', '')}»" for h in hotels[:2] if getattr(h, "name", None)]

    parts = []
    if slots.max_price_per_night_rub and min_cost > slots.max_price_per_night_rub:
        parts.append(
            f"В рамках бюджета до {slots.max_price_per_night_rub:,} ₽ отелей в {city} не нашлось (минимальная цена от {min_cost:,} ₽), "
            f"поэтому я отобрал {count} наиболее доступных и проверенных вариантов в этом регионе.".replace(",", " ")
        )
    elif slots.stars and slots.free_cancellation:
        parts.append(f"По вашему запросу подобрал {count} пятизвездочных отелей в {city} с опцией бесплатной отмены.")
    elif slots.stars:
        parts.append(f"Отобрал {count} отелей категории {slots.stars}★ в {city}.")
    elif slots.free_cancellation:
        parts.append(f"Подобрал {count} отелей в {city} с гарантией бесплатной отмены бронирования.")
    elif slots.pet_friendly:
        parts.append(f"Нашел {count} отличных вариантов в {city}, где с радостью примут вас с питомцем.")
    elif slots.heated_pool:
        parts.append(f"Подобрал {count} отелей с подогреваемым бассейном в {city}.")
    else:
        parts.append(f"Сформировал подборку из {count} лучших вариантов в {city}, точно подходящих под ваши критерии.")

    if top_names:
        parts.append(f"Обратите внимание на {', '.join(top_names)} — у них максимальный рейтинг и отличные отзывы.")
    parts.append(f"В карточках ниже доступна честная детализация стоимости на {slots.nights or 2} ночи без скрытых комиссий.")
    return " ".join(parts)

async def generate_concierge_response_stream(
    user_message: str,
    slots: ExtractedSlots,
    hotels: List[Any]
) -> AsyncGenerator[str, None]:
    """
    Генерирует живой диалоговый ответ агента Островка (Real LLM с каскадом).
    """
    safe_message = sanitize_user_input(user_message, max_length=1000)

    hotel_summaries = []
    for h in hotels[:3]:
        amenities = []
        if getattr(h, "stars", None):
            amenities.append(f"{h.stars}★")
        if getattr(h, "match_score_pct", None):
            amenities.append(f"Match {h.match_score_pct}%")
        if getattr(h, "min_price_per_night_rub", None):
            amenities.append(f"от {h.min_price_per_night_rub:,} ₽".replace(",", " "))
        hotel_summaries.append(f"• «{getattr(h, 'name', '')}» ({getattr(h, 'city', '')}, {', '.join(amenities)})")

    hotels_context = "\n".join(hotel_summaries) if hotel_summaries else "Отели не найдены"
    min_cost = min((getattr(h, "min_price_per_night_rub", 0) for h in hotels), default=0)
    budget_note = ""
    if slots.max_price_per_night_rub and min_cost > slots.max_price_per_night_rub:
        budget_note = f"\nВажно: бюджет гостя {slots.max_price_per_night_rub} ₽ ниже минимальной цены в регионе ({min_cost} ₽). Поясни это и представь варианты от {min_cost} ₽."

    prompt_text = (
        f"{SYSTEM_CONCIERGE_PROMPT}\n\n"
        f"Запрос пользователя: «{safe_message}»\n"
        f"Параметры: город {slots.city or 'не указан'}, {slots.guests_count or 2} гостей, {slots.nights or 2} ночей.{budget_note}\n"
        f"Найденные отели (всего {len(hotels)} шт.):\n{hotels_context}\n\n"
        f"Ответ агента:"
    )

    if settings.GEMINI_API_KEY and hotels:
        has_content = False
        async for chunk in stream_gemini_content(prompt_text, timeout_sec=5.0):
            has_content = True
            yield chunk
        if has_content:
            return

    # Детерминированный живой ответ
    fallback_text = build_deterministic_concierge_response(safe_message, slots, hotels)
    words = fallback_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield chunk
        await asyncio.sleep(0.02)
