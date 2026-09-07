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

SYSTEM_CONCIERGE_PROMPT = """Ты — персональный AI-консьерж сервиса бронирования отелей «Островок».
Твоя задача — дать живой, тёплый, профессиональный ответ пользователю по найденным отелям.

Правила:
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать шаблонные клише («Я нашел 6 отелей в выбранном регионе...»). Говори живым человеческим языком.
2. Обратись к запросу пользователя: подтверди город, звездность, бюджет или удобства (спа, бассейн, питомцы, бесплатная отмена).
3. Назови 1-2 конкретных отеля из предоставленного списка, отметь их ключевые преимущества.
4. Ответ должен быть ёмким: 2-3 связных предложения. Не выдумывай отели, которых нет в списке.
"""

def _get_cascade_models() -> list[str]:
    models = [settings.PRIMARY_MODEL]
    fallback_list = getattr(settings, "FALLBACK_MODELS", [settings.FALLBACK_MODEL])
    for m in fallback_list:
        if m not in models:
            models.append(m)
    return models



async def think_stream(user_message: str, slots: ExtractedSlots | None = None) -> AsyncGenerator[str, None]:
    """
    Потоковая генерация хода рассуждения агента (Thinking Process).
    Каскад:
    1. Gemini PRIMARY_MODEL (стриминг токенов мысли)
    2. Последовательный перебор резервных моделей из FALLBACK_MODELS
    3. Детерминированное осмысленное рассуждение на базе реальных слотов
    """
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            gen_config = types.GenerateContentConfig(
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
            )
            models_to_try = _get_cascade_models()

            for idx, model_name in enumerate(models_to_try):
                try:
                    stream = await asyncio.wait_for(
                        client.aio.models.generate_content_stream(
                            model=model_name,
                            contents=[
                                {"role": "user", "parts": [{"text": f"{SYSTEM_THINKING_PROMPT}\n\nЗапрос пользователя:\n{user_message}"}]}
                            ],
                            config=gen_config,
                        ),
                        timeout=5.0
                    )
                    has_content = False
                    async for chunk in stream:
                        if chunk.text:
                            has_content = True
                            yield chunk.text
                    if has_content:
                        return

                except Exception as e:
                    next_target = models_to_try[idx + 1] if idx + 1 < len(models_to_try) else "детерминированное рассуждение"
                    print(f"[LLM Thinking] Ошибка {model_name}: {e}. Переход на {next_target}...")
        except Exception as client_err:
            print(f"[LLM Thinking Client Error]: {client_err}")

    # Детерминированный fallback, основанный на реальных извлеченных слотах
    if slots is None:
        slots = _mock_extract_slots(user_message)
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

    return " ".join(parts)

async def generate_concierge_response_stream(
    user_message: str,
    slots: ExtractedSlots,
    hotels: list
) -> AsyncGenerator[str, None]:
    """
    Генерирует живой диалоговый ответ консьержа Островка (Real LLM, без шаблонов).
    """
    hotel_summaries = []
    for h in hotels[:3]:
        amenities = []
        if getattr(h, "stars", None):
            amenities.append(f"{h.stars}★")
        if getattr(h, "match_score_pct", None):
            amenities.append(f"Match {h.match_score_pct}%")
        if getattr(h, "min_price_per_night_rub", None):
            amenities.append(f"от {h.min_price_per_night_rub:,} ₽".replace(",", " "))
        hotel_summaries.append(f"• «{h.name}» ({h.city}, {', '.join(amenities)})")
    
    hotels_context = "\n".join(hotel_summaries) if hotel_summaries else "Отели не найдены"
    min_cost = min((getattr(h, "min_price_per_night_rub", 0) for h in hotels), default=0)
    budget_note = ""
    if slots.max_price_per_night_rub and min_cost > slots.max_price_per_night_rub:
        budget_note = f"\nВажно: бюджет гостя {slots.max_price_per_night_rub} ₽ ниже минимальной цены в регионе ({min_cost} ₽). Поясни это и представь варианты от {min_cost} ₽."

    prompt_text = (
        f"{SYSTEM_CONCIERGE_PROMPT}\n\n"
        f"Запрос пользователя: «{user_message}»\n"
        f"Параметры: город {slots.city or 'не указан'}, {slots.guests_count or 2} гостей, {slots.nights or 2} ночей.{budget_note}\n"
        f"Найденные отели (всего {len(hotels)} шт.):\n{hotels_context}\n\n"
        f"Ответ консьержа:"
    )

    if settings.GEMINI_API_KEY and hotels:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            gen_config = types.GenerateContentConfig(
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
            )
            models_to_try = _get_cascade_models()

            for idx, model_name in enumerate(models_to_try):
                try:
                    stream = await asyncio.wait_for(
                        client.aio.models.generate_content_stream(
                            model=model_name,
                            contents=[{"role": "user", "parts": [{"text": prompt_text}]}],
                            config=gen_config,
                        ),
                        timeout=5.0
                    )
                    has_content = False
                    async for chunk in stream:
                        if chunk.text:
                            has_content = True
                            yield chunk.text
                    if has_content:
                        return
                except Exception as e:
                    print(f"[LLM Concierge] Ошибка {model_name}: {e}. Пробуем следующую модель...")
        except Exception as e:
            print(f"[LLM Concierge Exception]: {e}")

    # Детерминированный живой ответ
    fallback_text = _build_deterministic_concierge_response(user_message, slots, hotels)
    words = fallback_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield chunk
        await asyncio.sleep(0.02)


def _build_deterministic_concierge_response(user_message: str, slots: ExtractedSlots, hotels: list) -> str:
    if not hotels:
        city = slots.city or "выбранном направлении"
        return f"По вашему запросу отели в {city} не найдены. Попробуйте скорректировать фильтры или расширить ценовой диапазон."

    city = slots.city or getattr(hotels[0], "city", "выбранном регионе")
    count = len(hotels)
    min_cost = min((getattr(h, "min_price_per_night_rub", 0) for h in hotels), default=0)
    top_names = [f"«{getattr(h, 'name', '')}»" for h in hotels[:2] if getattr(h, 'name', None)]

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


async def extract_slots_cascade(user_message: str) -> ExtractedSlots:

    """
    Каскадный экстрактор:
    1. Gemini PRIMARY_MODEL (по умолчанию gemini-3.5-flash-lite)
    2. Резервные модели из FALLBACK_MODELS (gemini-3.5-flash, gemini-flash-lite-latest, etc.)
    3. Детерминированный Mock-экстрактор
    """
    if settings.GEMINI_API_KEY:
        models_to_try = _get_cascade_models()
        for idx, model_name in enumerate(models_to_try):
            try:
                return await _call_gemini(user_message, model_name)
            except Exception as e:
                next_target = models_to_try[idx + 1] if idx + 1 < len(models_to_try) else "Local Mock"
                print(f"[LLM Cascade] Ошибка {model_name}: {e}. Пробуем {next_target}...")

    return _mock_extract_slots(user_message)


async def _call_gemini(user_message: str, model_name: str) -> ExtractedSlots:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    gen_config = types.GenerateContentConfig(
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
    )

    response = await asyncio.wait_for(
        client.aio.models.generate_content(
            model=model_name,
            contents=[
                {"role": "user", "parts": [{"text": f"{SYSTEM_EXTRACTOR_PROMPT}\n\nЗапрос пользователя:\n{user_message}"}]}
            ],
            config=gen_config,
        ),
        timeout=6.0,
    )

    
    text = response.text or ""
    # Очистка markdown блоков json
    text = re.sub(r"^```json\s*", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"^```\s*$", "", text.strip(), flags=re.MULTILINE)
    
    data = json.loads(text.strip())
    raw_chips = data.get("disambiguation_suggestions") or _default_chips(user_message)
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
        disambiguation_suggestions=_sanitize_chips(raw_chips)
    )

def _sanitize_chips(chips: list[str]) -> list[str]:
    sanitized = []
    for c in chips:
        # Если в чипсе указана нереалистично низкая цена (<3000), корректируем
        m = re.search(r"до\s*(\d[\s\d]*)\s*₽", c.lower())
        if m:
            val = int(m.group(1).replace(" ", ""))
            if val < 3000:
                c = "До 5 000 ₽ / ночь"
        if c not in sanitized:
            sanitized.append(c)
    return sanitized

def _mock_extract_slots(text: str) -> ExtractedSlots:
    """
    Детерминированный офлайн-экстрактор на регулярных выражениях и словарях.
    Обеспечивает 100% работоспособность на питче.
    """
    lower = text.lower()
    
    # Город (с поддержкой падежей)
    city = None
    if re.search(r"красн\w*\s+полян|полян", lower):
        city = "Красная Поляна"
    elif "сочи" in lower:
        city = "Сочи"
    elif re.search(r"питер|петербург", lower):
        city = "Санкт-Петербург"
    elif re.search(r"москв", lower):
        city = "Москва"
    elif re.search(r"казан", lower):
        city = "Казань"
    elif re.search(r"калининград", lower):
        city = "Калининград"
            
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
