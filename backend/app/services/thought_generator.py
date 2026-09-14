import asyncio
from typing import AsyncGenerator, Optional
from ..config import settings
from ..schemas.chat import ExtractedSlots
from .text_helpers import sanitize_user_input
from .slot_extractor import mock_extract_slots
from .llm_client import stream_gemini_content

SYSTEM_THINKING_PROMPT = """Ты — интеллектуальный AI-агент консьерж-сервиса Островок.
Пользователь отправил запрос на поиск отеля или уточнение параметров.
Твоя задача — рассуждать вслух по-русски в стиле мыслительного процесса LLM (Thinking Process):
- Живо и емко проанализируй, что хочет пользователь (город/курорт, атмосфера, состав гостей, особые удобства: питомцы, спа, бассейн, бюджет).
- Обозначь ключевую тактику отбора и критерии проверки чека.
- Пиши 2-4 связных предложения от первого лица («Оцениваю запрос...», «Учитываю...»).
- Строго без JSON, без списков с маркерами и без markdown-заголовков — только естественный мыслительный поток.
"""

def build_deterministic_reasoning(user_message: str, slots: ExtractedSlots) -> str:
    """
    Формирует содержательное рассуждение на основе реального запроса и извлеченных слотов.
    """
    parts = []
    if slots.city:
        parts.append(f"Анализирую запрос на размещение в регионе {slots.city}.")
    else:
        parts.append(f"Анализирую запрос пользователя: «{user_message}».")

    reqs = []
    if slots.pet_friendly:
        reqs.append("размещение с питомцем (требуется проверка политики и расчет депозита)")
    if slots.heated_pool:
        reqs.append("наличие круглогодичного подогреваемого бассейна")
    if slots.spa:
        reqs.append("наличие СПА-комплекса")
    if slots.breakfast_included:
        reqs.append("включенный завтрак")
    if slots.free_cancellation:
        reqs.append("опция бесплатной отмены брони")
    if slots.stars:
        reqs.append(f"категория от {slots.stars} звезд")
    if slots.max_price_per_night_rub:
        reqs.append(f"ограничение бюджета до {slots.max_price_per_night_rub:,} ₽/ночь".replace(",", " "))

    if reqs:
        parts.append(f"Ключевые критерии отбора: {', '.join(reqs)}.")
    else:
        parts.append("Специфических ограничений по удобствам не задано — приоритизирую отели с наивысшим рейтингом гостей.")

    return " ".join(parts)

async def think_stream(user_message: str, slots: Optional[ExtractedSlots] = None) -> AsyncGenerator[str, None]:
    """
    Потоковая генерация хода рассуждения агента (Thinking Process).
    Каскад:
    1. Gemini PRIMARY_MODEL (стриминг токенов мысли)
    2. Последовательный перебор резервных моделей из FALLBACK_MODELS
    3. Детерминированное осмысленное рассуждение на базе реальных слотов
    """
    safe_message = sanitize_user_input(user_message, max_length=1000)

    if settings.GEMINI_API_KEY:
        prompt_text = f"{SYSTEM_THINKING_PROMPT}\n\nЗапрос пользователя:\n{safe_message}"
        has_content = False
        async for chunk in stream_gemini_content(prompt_text, timeout_sec=5.0):
            has_content = True
            yield chunk
        if has_content:
            return

    # Детерминированный fallback, основанный на реальных извлеченных слотах
    if slots is None:
        slots = mock_extract_slots(safe_message)
    fallback_text = build_deterministic_reasoning(safe_message, slots)
    words = fallback_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield chunk
        await asyncio.sleep(0.02)
