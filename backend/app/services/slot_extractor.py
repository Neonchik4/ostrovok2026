import asyncio
import re
import json
from typing import List, Optional
from ..config import settings
from ..schemas.chat import ExtractedSlots
from .text_helpers import sanitize_user_input
from .llm_client import get_cascade_models
from .location_registry import match_city, get_known_cities

SYSTEM_EXTRACTOR_PROMPT = """Ты — интеллектуальный экстрактор параметров поиска отелей для платформы Ostrovok.
Твоя задача — ТОЛЬКО извлечь параметры из запроса пользователя и вернуть строго JSON-объект без пояснений.
Никаких выдуманных отелей, никаких цен, только слоты:
{
  "city": "Сочи" | "Красная Поляна" | "Москва" | "Санкт-Петербург" | "Казань" | "Калининград" | "Екатеринбург" | "Нижний Новгород" | "Шерегеш" | "Алтай" | "Иркутск (Байкал)" | "Дагестан (Махачкала)" | "Карелия (Петрозаводск)" | "Владивосток" | "Анапа" | "Геленджик" | "Зеленоградск" | "Мурманск" | "Самара" | null,
  "stars": int (1-5) | null,
  "max_price_per_night_rub": int | null,
  "pet_friendly": bool | null,
  "heated_pool": bool | null,
  "spa": bool | null,
  "breakfast_included": bool | null,
  "free_cancellation": bool | null,
  "guests_count": int | null,
  "nights": int | null,
  "semantic_query": "строка с ключевыми пожеланиями к атмосфере и локации",
  "disambiguation_suggestions": ["Только с завтраком", "До 8 000 ₽ / ночь"]
}

ВАЖНО: поле disambiguation_suggestions — это список ГОТОВЫХ ФИЛЬТРОВ-ДЕЙСТВИЙ для быстрого уточнения поиска.
Каждый чипс — это короткая фраза-действие (не вопрос!), которую пользователь может добавить одним кликом.
Примеры корректных чипсов: "Только с завтраком", "С теплым бассейном", "До 8 000 ₽ / ночь",
"Свободная отмена", "С видом на горы", "Рядом с подъемником", "5 звезд", "Со спа".
Генерируй 3-4 релевантных чипса, которых ещё нет в запросе пользователя.
"""

def sanitize_chips(chips: List[str]) -> List[str]:
    """
    Secure by Design:
    - Проверка аномалий в чипсах (нереалистично низкая цена <3000 руб.).
    - Устранение дубликатов с сохранением порядка.
    - Ограничение длины строки чипса.
    """
    sanitized: List[str] = []
    for c in chips:
        c_clean = c.strip()
        if not c_clean or len(c_clean) > 80:
            continue
        m = re.search(r"до\s*(\d[\s\d]*)\s*₽", c_clean.lower())
        if m:
            val = int(m.group(1).replace(" ", ""))
            if val < 3000:
                c_clean = "До 5 000 ₽ / ночь"
        if c_clean not in sanitized:
            sanitized.append(c_clean)
    return sanitized

def default_chips(lower: str) -> List[str]:
    """Генерация базовых чипсов-действий на основе отсутствующих параметров."""
    chips: List[str] = []
    if "завтрак" not in lower:
        chips.append("Только с завтраком")
    if "бассейн" not in lower:
        chips.append("С теплым бассейном")
    if "цена" not in lower and "руб" not in lower and "000" not in lower:
        chips.append("До 10 000 ₽ / ночь")
    if "вид" not in lower and "гор" not in lower:
        chips.append("С видом на горы")
    if "отмен" not in lower and "cancel" not in lower:
        chips.append("Свободная отмена")
    return chips[:4]

def mock_extract_slots(text: str) -> ExtractedSlots:
    """
    Детерминированный офлайн-экстрактор на регулярных выражениях и словарях.
    Обеспечивает 100% стабильность работы при любых сетевых отказах.
    """
    safe_text = sanitize_user_input(text, max_length=1000)
    lower = safe_text.lower()

    # Город (динамический поиск через реестр локаций с падежами и алиасами)
    city = match_city(safe_text)

    # Питомцы
    pet_friendly = True if re.search(r"собак|кошк|питомц|животн|псом|с догом", lower) else None

    # Бассейн
    heated_pool = True if re.search(r"бассейн|теплый бассейн|подогрев", lower) else None

    # СПА
    spa = True if re.search(r"спа|spa|саун|хаммам|баня", lower) else None

    # Завтрак
    breakfast = True if re.search(r"завтрак|шведский стол|питание", lower) else None

    # Бесплатная / свободная отмена
    free_cancellation = True if re.search(r"бесплатн\w*\s+отмен|свободн\w*\s+отмен|без штрафа", lower) else None

    # Звезды
    stars = None
    m_stars = re.search(r"(\d)\s*(?:звезд|\*)", lower)
    if m_stars:
        stars = int(m_stars.group(1))
    elif "пять звезд" in lower or "5*" in lower:
        stars = 5
    elif "четыре звезды" in lower or "4*" in lower:
        stars = 4
    if stars is not None:
        stars = max(1, min(5, stars))

    # Количество гостей
    guests = 2
    m_guests = re.search(r"(?:для|на|нас)\s*(\d+)", lower)
    if m_guests:
        guests = int(m_guests.group(1))
    elif "вдвоем" in lower or "двоих" in lower:
        guests = 2
    elif "один" in lower or "одного" in lower:
        guests = 1
    guests = max(1, min(20, guests))

    # Ночи
    nights = 2
    m_nights = re.search(r"(\d+)\s*(?:ноч|дн|сут)", lower)
    if m_nights:
        nights = int(m_nights.group(1))
    nights = max(1, min(90, nights))

    # Цена
    max_price = None
    m_price = re.search(r"(?:до|бюджет|цена|за)?\s*(\d+[\s\d]*)\s*(млн|миллион|к|тыс|руб|р|$)", lower)
    if m_price:
        num_str = m_price.group(1).replace(" ", "")
        if num_str.isdigit():
            val = int(num_str)
            unit = m_price.group(2) if len(m_price.groups()) > 1 else ""
            if "млн" in unit or "миллион" in unit:
                val *= 1_000_000
            elif "тыс" in unit or unit == "к" or (val < 100 and unit in ("руб", "р")):
                val *= 1000
            if val > 0:
                max_price = val

    return ExtractedSlots(
        city=city,
        stars=stars,
        max_price_per_night_rub=max_price,
        pet_friendly=pet_friendly,
        heated_pool=heated_pool,
        spa=spa,
        breakfast_included=breakfast,
        free_cancellation=free_cancellation,
        guests_count=guests,
        nights=nights,
        semantic_query=safe_text,
        disambiguation_suggestions=default_chips(lower),
    )

async def _call_gemini_extractor(user_message: str, model_name: str, key: str) -> ExtractedSlots:
    from google.genai import types
    from .llm_client import get_gemini_client

    client = get_gemini_client(key)
    gen_config = types.GenerateContentConfig.model_validate(
        {"automatic_function_calling": {"disable": True}}
    )

    safe_message = sanitize_user_input(user_message, max_length=1000)
    response = await asyncio.wait_for(
        client.aio.models.generate_content(
            model=model_name,
            contents=[
                {"role": "user", "parts": [{"text": f"{SYSTEM_EXTRACTOR_PROMPT}\n\nЗапрос пользователя:\n{safe_message}"}]}
            ],
            config=gen_config,
        ),
        timeout=6.0,
    )

    text = response.text or ""
    text = re.sub(r"^```json\s*", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"^```\s*$", "", text.strip(), flags=re.MULTILINE)

    data = json.loads(text.strip())
    raw_chips = data.get("disambiguation_suggestions") or default_chips(safe_message.lower())

    guests = data.get("guests_count") or 2
    try:
        guests = max(1, min(20, int(guests)))
    except (ValueError, TypeError):
        guests = 2

    nights = data.get("nights") or 2
    try:
        nights = max(1, min(90, int(nights)))
    except (ValueError, TypeError):
        nights = 2

    stars = data.get("stars")
    if stars is not None:
        try:
            stars = max(1, min(5, int(stars)))
        except (ValueError, TypeError):
            stars = None

    return ExtractedSlots(
        city=data.get("city"),
        stars=stars,
        max_price_per_night_rub=data.get("max_price_per_night_rub"),
        pet_friendly=data.get("pet_friendly"),
        heated_pool=data.get("heated_pool"),
        spa=data.get("spa"),
        breakfast_included=data.get("breakfast_included"),
        free_cancellation=data.get("free_cancellation"),
        guests_count=guests,
        nights=nights,
        semantic_query=data.get("semantic_query") or safe_message,
        disambiguation_suggestions=sanitize_chips(raw_chips),
    )

async def extract_slots_cascade(user_message: str) -> ExtractedSlots:
    """
    Каскадный экстрактор слотов:
    1. Gemini PRIMARY_MODEL
    2. Резервные модели из FALLBACK_MODELS на всех доступных ключах (через Cloudflare AI Gateway)
    3. Детерминированный офлайн-экстрактор
    """
    from .llm_client import _build_attempts
    attempts = _build_attempts()
    for idx, (key, model_name) in enumerate(attempts):
        try:
            return await _call_gemini_extractor(user_message, model_name, key)
        except Exception as e:
            next_target = attempts[idx + 1] if idx + 1 < len(attempts) else None
            next_desc = f"{next_target[1]}" if next_target else "Local Mock"
            print(f"[LLM Cascade] Ошибка {model_name}: {e}. Пробуем {next_desc}...")

    return mock_extract_slots(user_message)

