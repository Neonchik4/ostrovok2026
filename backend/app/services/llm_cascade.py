import asyncio
import re
import json
from typing import AsyncGenerator
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
  "disambiguation_suggestions": ["Только с завтраком", "До 8 000 ₽ / ночь"]
}

ВАЖНО: поле disambiguation_suggestions — это список ГОТОВЫХ ФИЛЬТРОВ-ДЕЙСТВИЙ для быстрого уточнения поиска.
Каждый чипс — это короткая фраза-действие (не вопрос!), которую пользователь может добавить одним кликом.
Примеры корректных чипсов: "Только с завтраком", "С теплым бассейном", "До 8 000 ₽ / ночь",
"Свободная отмена", "С видом на горы", "Рядом с подъемником", "5 звезд", "Со спа".
Генерируй 3-4 релевантных чипса, которых ещё нет в запросе пользователя.
"""

SYSTEM_THINKING_PROMPT = """Ты — интеллектуальный AI-агент консьерж-сервиса Островок.
Пользователь отправил запрос на поиск отеля или уточнение параметров.
Твоя задача — рассуждать вслух по-русски в стиле мыслительного процесса LLM (Thinking Process):
- Живо и емко проанализируй, что хочет пользователь (город/курорт, атмосфера, состав гостей, особые удобства: питомцы, спа, бассейн, бюджет).
- Обозначь ключевую тактику отбора и критерии проверки чека.
- Пиши 2-4 связных предложения от первого лица («Оцениваю запрос...», «Учитываю...»).
- Строго без JSON, без списков с маркерами и без markdown-заголовков — только естественный мыслительный поток.
"""

async def think_stream(user_message: str, slots: ExtractedSlots) -> AsyncGenerator[str, None]:
    """
    Потоковая генерация хода рассуждения агента (Thinking Process).
    Каскад:
    1. Gemini PRIMARY_MODEL (стриминг токенов мысли)
    2. Gemini FALLBACK_MODEL
    3. Детерминированное осмысленное рассуждение на базе реальных слотов
    """
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            stream = await client.aio.models.generate_content_stream(
                model=settings.PRIMARY_MODEL,
                contents=[
                    {"role": "user", "parts": [{"text": f"{SYSTEM_THINKING_PROMPT}\n\nЗапрос пользователя:\n{user_message}"}]}
                ]
            )
            has_content = False
            async for chunk in stream:
                if chunk.text:
                    has_content = True
                    yield chunk.text
            if has_content:
                return
        except Exception as e1:
            print(f"[LLM Thinking] Ошибка {settings.PRIMARY_MODEL}: {e1}. Пробуем {settings.FALLBACK_MODEL}...")
            try:
                from google import genai
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                stream = await client.aio.models.generate_content_stream(
                    model=settings.FALLBACK_MODEL,
                    contents=[
                        {"role": "user", "parts": [{"text": f"{SYSTEM_THINKING_PROMPT}\n\nЗапрос пользователя:\n{user_message}"}]}
                    ]
                )
                has_content = False
                async for chunk in stream:
                    if chunk.text:
                        has_content = True
                        yield chunk.text
                if has_content:
                    return
            except Exception as e2:
                print(f"[LLM Thinking] Ошибка {settings.FALLBACK_MODEL}: {e2}. Переход на детерминированное рассуждение...")

    # Детерминированный fallback, основанный на реальных извлеченных слотах
    fallback_text = _build_deterministic_reasoning(user_message, slots)
    words = fallback_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield chunk
        await asyncio.sleep(0.02)

def _build_deterministic_reasoning(user_message: str, slots: ExtractedSlots) -> str:
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

    parts.append(f"Формирую пул предложений для {slots.guests_count or 2} гостей на {slots.nights or 2} ночи с расчетом прозрачного чека без скрытых комиссий.")
    return " ".join(parts)

async def extract_slots_cascade(user_message: str) -> ExtractedSlots:
    """
    Каскадный экстрактор:
    1. Gemini 2.0 / 3.x Flash
    2. Gemini 1.5 Flash-8b
    3. Детерминированный Mock-экстрактор
    """
    if settings.GEMINI_API_KEY:
        try:
            return await _call_gemini(user_message, settings.PRIMARY_MODEL)
        except Exception as e1:
            print(f"[LLM Cascade] Ошибка {settings.PRIMARY_MODEL}: {e1}. Пробуем {settings.FALLBACK_MODEL}...")
            try:
                return await _call_gemini(user_message, settings.FALLBACK_MODEL)
            except Exception as e2:
                print(f"[LLM Cascade] Ошибка {settings.FALLBACK_MODEL}: {e2}. Переход на Local Mock...")

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
    if "цена" not in lower and "руб" not in lower and "000" not in lower:
        chips.append("До 10 000 ₽ / ночь")
    if "вид" not in lower and "гор" not in lower:
        chips.append("С видом на горы")
    if "отмен" not in lower and "cancel" not in lower:
        chips.append("Свободная отмена")
    return chips[:4]
