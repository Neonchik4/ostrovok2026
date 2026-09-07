import re
import json
from typing import Dict, Any, Optional
from ..config import settings
from ..schemas.chat import ExtractedSlots

SYSTEM_EXTRACTOR_PROMPT = """Ты — интеллектуальный экстрактор параметров поиска отелей для платформы Ostrovok.
Твоя задача — ТОЛЬКО извлечь параметры из запроса пользователя и вернуть строго JSON-объект без пояснений.
Никаких выдуманных отелей, никаких цен, только слоты:
{
  "city": "Сочи" | "Красная Поляна" | "Москва" | "Санкт-Петербург" | "Казань" | "Калининград" | null,
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
  "disambiguation_suggestions": ["вопрос 1 для чипса", "вопрос 2"]
}
"""

async def extract_slots_cascade(user_message: str) -> ExtractedSlots:
    """
    Каскадный экстрактор:
    1. Gemini 2.0 / 3.x Flash
    2. Gemini 1.5 Flash-8b
    3. Детерминированный Mock-экстрактор
    """
    # Если ключ есть, пробуем Gemini
    if settings.GEMINI_API_KEY:
        try:
            return await _call_gemini(user_message, settings.PRIMARY_MODEL)
        except Exception as e1:
            print(f"[LLM Cascade] Ошибка {settings.PRIMARY_MODEL}: {e1}. Пробуем {settings.FALLBACK_MODEL}...")
            try:
                return await _call_gemini(user_message, settings.FALLBACK_MODEL)
            except Exception as e2:
                print(f"[LLM Cascade] Ошибка {settings.FALLBACK_MODEL}: {e2}. Переход на Local Mock...")

    # Fallback на локальный детерминированный экстрактор
    return _mock_extract_slots(user_message)

async def _call_gemini(user_message: str, model_name: str) -> ExtractedSlots:
    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    response = client.models.generate_content(
        model=model_name,
        contents=[
            {"role": "user", "parts": [{"text": f"{SYSTEM_EXTRACTOR_PROMPT}\n\nЗапрос пользователя:\n{user_message}"}]}
        ]
    )
    
    text = response.text or ""
    # Очистка markdown блоков json
    text = re.sub(r"^```json\s*", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"^```\s*$", "", text.strip(), flags=re.MULTILINE)
    
    data = json.loads(text.strip())
    return ExtractedSlots(
        city=data.get("city"),
        stars=data.get("stars"),
        max_price_per_night_rub=data.get("max_price_per_night_rub"),
        pet_friendly=data.get("pet_friendly"),
        heated_pool=data.get("heated_pool"),
        spa=data.get("spa"),
        breakfast_included=data.get("breakfast_included"),
        free_cancellation=data.get("free_cancellation"),
        guests_count=data.get("guests_count") or 2,
        nights=data.get("nights") or 2,
        semantic_query=data.get("semantic_query") or user_message,
        disambiguation_suggestions=data.get("disambiguation_suggestions") or _default_chips(user_message)
    )

def _mock_extract_slots(text: str) -> ExtractedSlots:
    """
    Детерминированный офлайн-экстрактор на регулярных выражениях и словарях.
    Обеспечивает 100% работоспособность на питче.
    """
    lower = text.lower()
    
    # Город
    city = None
    city_map = {
        "красная поляна": "Красная Поляна",
        "поляна": "Красная Поляна",
        "сочи": "Сочи",
        "питер": "Санкт-Петербург",
        "петербург": "Санкт-Петербург",
        "москва": "Москва",
        "казань": "Казань",
        "калининград": "Калининград"
    }
    for k, v in city_map.items():
        if k in lower:
            city = v
            break
            
    # Питомцы
    pet_friendly = bool(re.search(r"собак|кошк|питомц|животн|псом|с догом", lower))
    
    # Бассейн
    heated_pool = bool(re.search(r"бассейн|теплый бассейн|подогрев", lower))
    
    # СПА
    spa = bool(re.search(r"спа|spa|саун|хаммам|баня", lower))
    
    # Завтрак
    breakfast = bool(re.search(r"завтрак|шведский стол|питание", lower))
    
    # Звезды
    stars = None
    m_stars = re.search(r"(\d)\s*(?:звезд|\*)", lower)
    if m_stars:
        stars = int(m_stars.group(1))
    elif "пять звезд" in lower or "5*" in lower:
        stars = 5
    elif "четыре звезды" in lower or "4*" in lower:
        stars = 4

    # Количество гостей
    guests = 2
    m_guests = re.search(r"(?:для|на|нас)\s*(\d+)", lower)
    if m_guests:
        guests = int(m_guests.group(1))
    elif "вдвоем" in lower or "двоих" in lower:
        guests = 2
    elif "один" in lower or "одного" in lower:
        guests = 1
        
    # Ночи
    nights = 2
    m_nights = re.search(r"(\d+)\s*(?:ноч|дн|сут)", lower)
    if m_nights:
        nights = int(m_nights.group(1))
        
    # Цена
    max_price = None
    m_price = re.search(r"(?:до|бюджет)\s*(\d+[\s\d]*)\s*(?:к|тыс|руб|р|$)", lower)
    if m_price:
        num_str = m_price.group(1).replace(" ", "")
        val = int(num_str)
        if val < 100:  # например 10к -> 10000
            val *= 1000
        max_price = val

    return ExtractedSlots(
        city=city or "Красная Поляна",
        stars=stars,
        max_price_per_night_rub=max_price,
        pet_friendly=pet_friendly,
        heated_pool=heated_pool,
        spa=spa,
        breakfast_included=breakfast if breakfast else None,
        guests_count=guests,
        nights=nights,
        semantic_query=text,
        disambiguation_suggestions=_default_chips(lower)
    )

def _default_chips(lower: str) -> list[str]:
    chips = []
    if "завтрак" not in lower:
        chips.append("Только с завтраком")
    if "бассейн" not in lower:
        chips.append("С теплым бассейном")
    if "цена" not in lower and "руб" not in lower:
        chips.append("До 10 000 ₽ / ночь")
    if "вид" not in lower:
        chips.append("С видом на горы")
    return chips[:3]
