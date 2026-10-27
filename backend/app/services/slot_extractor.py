import asyncio
import json
import re

from ..schemas.chat import ExtractedSlots
from .location_registry import match_city
from .route_extractor import (
    default_chips,
    extract_depart_date,
    extract_route_cities,
    extract_transport_preference,
    sanitize_chips,
)
from .text_helpers import sanitize_user_input
from .thematic_destinations import match_thematic_destination

SYSTEM_EXTRACTOR_PROMPT = """Ты — интеллектуальный экстрактор параметров поиска отелей и билетов для Ostrovok.
Извлеки параметры из запроса пользователя и верни строго JSON-объект без пояснений:
{
  "city": "Город назначения (один из 19 регионов каталога)" | null,
  "origin_city": "Город отправления (откуда едет/летит гость)" | null,
  "stars": int (1-5) | null,
  "max_price_per_night_rub": int | null,
  "total_trip_budget_rub": int | null,
  "depart_date": "YYYY-MM-DD" | null,
  "transport_preference": "train" | "flight" | "both" | null,
  "pet_friendly": bool | null,
  "heated_pool": bool | null,
  "spa": bool | null,
  "breakfast_included": bool | null,
  "free_cancellation": bool | null,
  "guests_count": int | null,
  "nights": int | null,
  "arrival_time": "HH:MM" | null,
  "semantic_query": "строка с пожеланиями к атмосфере",
  "intent": "search" | "review_inquiry",
  "disambiguation_suggestions": ["Хочу на поезде", "На самолете", "В эти выходные", "Бюджет до 50 000 ₽"]
}
Каждый чипс — короткая фраза-действие для быстрого уточнения (не вопрос!).

Примеры (Few-Shot):
Пример 1 (Начальный детальный запрос):
Запрос: "Ищем отель в Сочи для семьи 2 взрослых + 3 детей с 1 по 14 июля 2027, до 8000 за ночь, нужен бассейн"
Ответ:
{"city": "Сочи", "origin_city": null, "stars": null, "max_price_per_night_rub": 8000, "total_trip_budget_rub": null, "depart_date": "2027-07-01", "transport_preference": null, "pet_friendly": null, "heated_pool": true, "spa": null, "breakfast_included": null, "free_cancellation": null, "guests_count": 5, "nights": 13, "arrival_time": null, "semantic_query": "отель для семьи с детьми у бассейна", "intent": "search", "disambiguation_suggestions": ["Вылет из Москвы", "Выезд из СПб", "Только с завтраком", "Свободная отмена"]}

Пример 2 (Уточняющий фильтр):
Запрос: "только с завтраком и дешевле 7000 руб"
Ответ:
{"city": null, "origin_city": null, "stars": null, "max_price_per_night_rub": 7000, "total_trip_budget_rub": null, "depart_date": null, "transport_preference": null, "pet_friendly": null, "heated_pool": null, "spa": null, "breakfast_included": true, "free_cancellation": null, "guests_count": null, "nights": null, "arrival_time": null, "semantic_query": "только с завтраком дешевле 7000 руб", "intent": "search", "disambiguation_suggestions": ["Свободная отмена", "С теплым бассейном"]}

Пример 3 (Аспектный запрос отзывов):
Запрос: "чё по отзывам об этом отеле, какие минусы?"
Ответ:
{"city": null, "origin_city": null, "stars": null, "max_price_per_night_rub": null, "total_trip_budget_rub": null, "depart_date": null, "transport_preference": null, "pet_friendly": null, "heated_pool": null, "spa": null, "breakfast_included": null, "free_cancellation": null, "guests_count": null, "nights": null, "arrival_time": null, "semantic_query": "отзывы гостей и минусы", "intent": "review_inquiry", "disambiguation_suggestions": []}

Пример 4 (Логистика и ранний заезд):
Запрос: "можно заехать в 10 утра?"
Ответ:
{"city": null, "origin_city": null, "stars": null, "max_price_per_night_rub": null, "total_trip_budget_rub": null, "depart_date": null, "transport_preference": null, "pet_friendly": null, "heated_pool": null, "spa": null, "breakfast_included": null, "free_cancellation": null, "guests_count": null, "nights": null, "arrival_time": "10:00", "semantic_query": "ранний заезд в 10 утра", "intent": "search", "disambiguation_suggestions": []}
"""

def mock_extract_slots(text: str) -> ExtractedSlots:
    """
    Детерминированный офлайн-экстрактор на регулярных выражениях и словарях.
    Обеспечивает 100% стабильность работы при любых сетевых отказах.
    """
    safe_text = sanitize_user_input(text, max_length=1000)
    lower = safe_text.lower()

    # Маршрут: пункт отправления и назначения
    origin_city, city = extract_route_cities(safe_text)

    # Тематические направления (теплые края, море, горы, природа)
    thematic = match_thematic_destination(safe_text, origin_city=origin_city)
    thematic_category = None
    thematic_title = None
    candidate_cities: list[str] = []
    area_type = None
    if not city and thematic:
        thematic_category = thematic.category
        thematic_title = thematic.title
        candidate_cities = thematic.candidate_cities
        area_type = thematic.area_type

    # Питомцы
    if re.search(r"\bбез\s+(?:собак|кошек|питомц|животн|хорьк)", lower):
        pet_friendly = False
    elif re.search(r"собак|кошк|\bкот\w*|питомц|животн|псом|с догом|\bхорьк\w*|\bхорек\b", lower):
        pet_friendly = True
    else:
        pet_friendly = None

    # Бассейн
    if re.search(r"\bбез\s+(?:бассейн|подогрев)", lower):
        heated_pool = False
    elif re.search(r"бассейн|теплый бассейн|подогрев", lower):
        heated_pool = True
    else:
        heated_pool = None

    # СПА
    if re.search(r"\bбез\s+(?:спа|sauna|саун|бани|хаммам)", lower):
        spa = False
    elif re.search(r"\bспа\b|\bspa\b|саун|хаммам|баня", lower):
        spa = True
    else:
        spa = None

    # Завтрак
    if re.search(r"\bбез\s+(?:завтрак|питани)", lower):
        breakfast = False
    elif re.search(r"завтрак|шведский стол|питание", lower):
        breakfast = True
    else:
        breakfast = None

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
    m_eq = re.search(r"=\s*(\d+)\s*(?:человек\w*|гост\w*|персон\w*)", lower)
    if m_eq:
        guests = int(m_eq.group(1))
    else:
        _NUM_MAP = {
            "один": 1, "одна": 1, "одно": 1, "двое": 2, "два": 2, "две": 2,
            "трое": 3, "три": 3, "четверо": 4, "четыре": 4, "пятеро": 5, "пять": 5,
            "шестеро": 6, "шесть": 6, "семеро": 7, "семь": 7, "восемь": 8, "девять": 9, "десять": 10,
        }
        m_family = re.search(
            r"(\d+|один|одна|двое|два|две|трое|три|четверо|четыре|пятеро|пять)\s*взросл\w*(?:\s*(?:\+|и|,)\s*(\d+|один|одна|двое|два|две|трое|три|четверо|четыре)\s*(?:дет\w*|ребен\w*))?",
            lower,
        )
        if m_family and m_family.group(2):
            v1_raw = m_family.group(1)
            v2_raw = m_family.group(2)
            v1 = int(v1_raw) if v1_raw.isdigit() else _NUM_MAP.get(v1_raw, 2)
            v2 = int(v2_raw) if v2_raw.isdigit() else _NUM_MAP.get(v2_raw, 1)
            guests = v1 + v2
        elif m_family:
            v1_raw = m_family.group(1)
            guests = int(v1_raw) if v1_raw.isdigit() else _NUM_MAP.get(v1_raw, 2)
        else:
            m_guests = re.search(r"(?:для|на|нас)\s*(\d+)\s*(?:человек\w*|гост\w*|взросл\w*|персон\w*)", lower)
            if not m_guests:
                m_guests = re.search(r"\b(\d+)\s*(?:человек\w*|гост\w*|взросл\w*|персон\w*)", lower)
            if not m_guests:
                m_guests = re.search(r"(?:для|на|нас)\s*(\d+)(?!\s*(?:ноч|дн|сут|к\b|тыс|руб|р|₽|%|\*|звезд))", lower)
            if m_guests:
                guests = int(m_guests.group(1))
            elif "вдвоем" in lower or "двоих" in lower or "парой" in lower:
                guests = 2
            elif re.search(r"\b(?:одному|одного|в\s+одиночку|соло)\b|\b(?:для|на)\s+одн(?:ого|ому|у|а)\b|\bеду\s+(?:один|одна)\b|\bодна\s*,\s*без\s+компании\b|\bодна\b(?!\s*(?:из|ноч|недел|комнат))", lower):
                guests = 1
            elif re.search(r"\bодин\b(?!\s*(?:отел|номер|билет|день|раз|из|поезд|вариант|ребенок|дет))", lower):
                guests = 1
    guests = max(1, min(20, guests))

    # Ночи и даты поездки
    nights = 2
    duration_text = re.sub(r"\bчерез\s+(?:неделю|дней|день|месяц)\b", "", lower)
    duration_text = re.sub(r"\b(?:на\s+)?(?:\d+|один|два|три)\s+(?:дн[яей]|дня|день)\s+(?:позже|раньше)\b", "", duration_text)
    m_nights = re.search(r"(\d+)\s*(?:ноч|дн|сут)", duration_text)
    if m_nights:
        nights = int(m_nights.group(1))
    elif re.search(r"\b(?:на\s+)?пару\s+дней\b|\bвыходн\w*|\bвыхи\b", duration_text):
        nights = 2
    elif re.search(r"\bна\s+(?:одну\s+)?ночь\b|\b1\s*(?:ночь|день|сут)", duration_text):
        nights = 1
    elif re.search(r"\bна\s+недел\w*|\bнедел[юеяи]\b|7\s+дней", duration_text) or "недел" in duration_text:
        nights = 7
    else:
        m_range = re.search(r"(?:заезд|приезд|с|от)\s*(\d{1,2})(?:\s*[а-яё]+)?\s*(?:по|до|-|—|,?\s*выезд\s*(?:в|до)?)\s*(\d{1,2})", duration_text)
        if not m_range:
            m_range = re.search(r"(?:с|от)\s*(\d{1,2})\s*(?:по|до|-)\s*(\d{1,2})", duration_text)
        if m_range:
            d1, d2 = int(m_range.group(1)), int(m_range.group(2))
            if 0 < d1 < d2 <= 31:
                nights = d2 - d1
    nights = max(1, min(90, nights))

    # Бюджет (общий на поездку или за ночь)
    max_price = None
    total_budget = None

    def _parse_num_and_unit(num_text: str, unit_text: str) -> int | None:
        clean = num_text.replace(" ", "")
        if not clean.isdigit():
            return None
        v = int(clean)
        u = unit_text.lower() if unit_text else ""
        if "млн" in u or "миллион" in u:
            v *= 1_000_000
        elif "тыс" in u or u == "к" or u == "k" or (v < 100 and u in ("руб", "р", "₽")):
            v *= 1000
        return v if v > 0 else None

    # Явный общий бюджет вида 'общий бюджет на всю компанию до 60 000 руб'
    pat_obsh = re.search(
        r"общ\w*\s+бюджет(?:\s+(?:на\s+)?(?:всю\s+)?(?:компанию|поездку|все|вс[её]))?(?:\s*—|\s*-)?(?:\s*до)?\s*(\d+[\s\d]*)\s*(млн|миллион|к|k|тыс|руб|р|₽)?",
        lower,
    )
    if pat_obsh:
        parsed_obsh = _parse_num_and_unit(
            pat_obsh.group(1),
            pat_obsh.group(2) if len(pat_obsh.groups()) > 1 and pat_obsh.group(2) else "",
        )
        if parsed_obsh:
            total_budget = parsed_obsh
            stay_budget = max(parsed_obsh - 6500, parsed_obsh // 2)
            max_price = max(1500, stay_budget // nights)

    is_explicit_night = bool(re.search(r"(?:за\s*ночь|в\s*сутки|/\s*ночь|/\s*сут|за\s*сутки)", lower))

    # Общий бюджет поездки (любой порядок слов: 'бюджет 67000', '67 тыс руб бюджет', '67000 на всё', '67к общий бюджет')
    pat_total_prefix = re.search(
        r"(?:(?:общий\s+)?бюджет(?:\s+на\s+вс[её]|\s+поездки)?|на\s+вс[её]\s+(?:до\s+)?|всего\s+(?:до\s+)?|под\s+ключ\s+(?:до\s+)?)\s*(\d+[\s\d]*)\s*(млн|миллион|к|k|тыс|руб|р|₽|$)",
        lower,
    )
    pat_total_suffix = re.search(
        r"(\d+[\s\d]*)\s*(млн|миллион|к|k|тыс|руб|р|₽)?\s*(?:(?:руб|р|₽)\s*)?(?:(?:общий\s+)?бюджет|на\s+вс[её]|под\s+ключ|всего)",
        lower,
    )

    if not total_budget and not is_explicit_night:
        parsed_total = None
        if pat_total_prefix:
            parsed_total = _parse_num_and_unit(
                pat_total_prefix.group(1),
                pat_total_prefix.group(2) if len(pat_total_prefix.groups()) > 1 else "",
            )
        elif pat_total_suffix:
            parsed_total = _parse_num_and_unit(
                pat_total_suffix.group(1),
                pat_total_suffix.group(2) if len(pat_total_suffix.groups()) > 1 else "",
            )

        if parsed_total:
            total_budget = parsed_total
            estimated_logistics = 6500
            stay_budget = max(parsed_total - estimated_logistics, parsed_total // 2)
            max_price = max(1500, stay_budget // nights)

    if not max_price:
        m_price = re.search(
            r"(?:до|цена(?:\s*(?:до|ниже))?|ниже|дешевле|не\s+дороже|не\s+более|бюджет(?:\s+до)?)\s*(\d+[\s\d]*)\s*(млн|миллион|к|k|тыс|руб|р|₽)?(?:\s*(?:за\s*ночь|в\s*сутки|/\s*ночь|/\s*сут|$|\b))",
            lower,
        )
        if not m_price:
            m_price = re.search(
                r"(\d+[\s\d]*)\s*(млн|миллион|к|k|тыс|руб|р|₽)?\s*(?:за\s*ночь|в\s*сутки|/\s*ночь|/\s*сут)",
                lower,
            )
        if not m_price:
            m_price = re.search(
                r"(\d+[\s\d]*)\s*(?:руб|р|₽)",
                lower,
            )
        if m_price:
            val = _parse_num_and_unit(
                m_price.group(1),
                m_price.group(2) if len(m_price.groups()) > 1 and m_price.group(2) else "",
            )
            if val:
                max_price = val

    # Время прибытия и состыковки (Issue #27)
    arrival_time = None
    m_time = re.search(
        r"(?:прибыва\w*|прилет\w*|приезд\w*|рейс\s+в|поезд\s+в|заезд\w*\s+в|заселен\w*\s+в|заехать\s+в|заселиться\s+в)\s*(\d{1,2}(?:[:.]\d{2})?)",
        lower,
    )
    if not m_time:
        m_time_hr = re.search(r"\bв\s*(\d{1,2})\s*(?:ночи|утра)\b", lower)
        if m_time_hr:
            hr = int(m_time_hr.group(1))
            arrival_time = f"{hr:02d}:00"
    if m_time and not arrival_time:
        raw_t = m_time.group(1).replace(".", ":")
        if ":" not in raw_t:
            hr = int(raw_t)
            raw_t = f"{hr:02d}:00"
        elif len(raw_t) == 4 and raw_t[1] == ":":
            raw_t = f"0{raw_t}"
        arrival_time = raw_t
    elif not arrival_time:
        if "ранний рейс" in lower or "утром" in lower:
            arrival_time = "07:30"
        elif "ночью" in lower or "ночной заезд" in lower:
            arrival_time = "02:30"

    needs_24h = True if (re.search(r"круглосуточн|24 часа|стойк.*24|ночн.*заезд|24/7|\bв\s+[0-4]\s*(?:ночи|утра)\b", lower) or (arrival_time and int(arrival_time.split(":")[0]) < 6)) else None
    needs_early = True if re.search(r"ранн\w*\s+заезд|ранн\w*\s+заселен|заехать\s+в\s+(?:10|11|9|8|0[89]|утра)", lower) else None
    if arrival_time:
        try:
            arr_h = int(arrival_time.split(":")[0])
            if 6 <= arr_h < 14:
                needs_early = True
            elif arr_h < 6:
                needs_24h = True
        except Exception:
            pass

    needs_late = True if re.search(r"поздн\w*\s+выезд|поздн\w*\s+выселен|продл\w*\s+номер", lower) else None
    needs_luggage = True if re.search(r"багаж|камер\w*\s+хранен|вещи оставить", lower) else None
    if needs_late:
        needs_luggage = True

    # Время выезда и состыковки отъезда
    departure_time = None
    m_dep = re.search(r"(?:выезд\s+в|отъезд\s+в|обратн\w*\s+(?:рейс|поезд)\s+в|вылет\s+в|уезд\s+в)\s*(\d{1,2}[:.]\d{2})", lower)
    if m_dep:
        raw_dt = m_dep.group(1).replace(".", ":")
        departure_time = f"0{raw_dt}" if len(raw_dt) == 4 and raw_dt[1] == ":" else raw_dt
    elif "поздний выезд" in lower or "выезд вечером" in lower or "обратно вечером" in lower:
        departure_time = "18:00"

    # Транспортные узлы (Issue #28)
    near_station = True if re.search(r"вокзал|ж/?д|станци", lower) else None
    near_airport = True if re.search(r"аэропорт|домодедов|шереметьев|внуков|пулков|адлер|кольцов|толмачев|жуковск", lower) else None

    max_dist_station = None
    m_dist = re.search(r"до\s*(\d+(?:[.,]\d+)?)\s*км\s*(?:от|до)?\s*вокзал", lower)
    if m_dist:
        max_dist_station = float(m_dist.group(1).replace(",", "."))

    depart_date = extract_depart_date(lower)
    inc_flight, inc_train, pref_transport = extract_transport_preference(lower)
    if pref_transport == "train":
        near_station = True
    elif pref_transport == "flight":
        near_airport = True

    include_flight = inc_flight if inc_flight is not None else (True if re.search(r"перелет|самолет|авиабилет", lower) else None)
    include_train = inc_train if inc_train is not None else (True if re.search(r"поезд|жд билеты|ж/д билеты", lower) else None)

    # Интент запроса отзывов (Issue #29)
    is_review_inquiry = False
    intent = "search"
    if re.search(r"ч[её]\s+по\s+отзывам|как\w*\s+(?:там\s+)?отзыв|что\s+.*отзыв|какие\s+минус|какие\s+плюс|репутаци|мнения\s+гостей|выжимк\w*\s+отзыв|расскажи\s+про\s+отзывы|плюсы\s+и\s+минусы", lower):
        is_review_inquiry = True
        intent = "review_inquiry"

    chips = thematic.suggested_chips if (not city and thematic) else default_chips(
        lower,
        origin=origin_city,
        city=city,
        transport_pref=pref_transport,
        depart_date=depart_date,
    )

    return ExtractedSlots(
        city=city,
        candidate_cities=candidate_cities,
        thematic_category=thematic_category,
        thematic_title=thematic_title,
        area_type=area_type,
        stars=stars,
        max_price_per_night_rub=max_price,
        total_trip_budget_rub=total_budget,
        pet_friendly=pet_friendly,
        heated_pool=heated_pool,
        spa=spa,
        breakfast_included=breakfast,
        free_cancellation=free_cancellation,
        guests_count=guests,
        nights=nights,
        arrival_time=arrival_time,
        departure_time=departure_time,
        needs_early_checkin=needs_early,
        needs_late_checkout=needs_late,
        needs_24h_front_desk=needs_24h,
        needs_luggage_storage=needs_luggage,
        near_station=near_station,
        near_airport=near_airport,
        max_distance_to_station_km=max_dist_station,
        origin_city=origin_city,
        depart_date=depart_date,
        include_flight=include_flight,
        include_train=include_train,
        transport_preference=pref_transport,
        semantic_query=safe_text,
        disambiguation_suggestions=chips,
        intent=intent,
        is_review_inquiry=is_review_inquiry,
    )

async def _call_gemini_extractor(user_message: str, model_name: str, key: str) -> ExtractedSlots:
    from google.genai import types

    from .llm_client import get_gemini_client

    client = get_gemini_client(key)
    gen_config = types.GenerateContentConfig.model_validate(
        {"automatic_function_calling": {"disable": True}}
    )

    safe_message = sanitize_user_input(user_message, max_length=1000)
    lower = safe_message.lower()

    # Детерминированное извлечение маршрута и транспорта как надежная основа
    det_orig, det_dest = extract_route_cities(safe_message)
    det_date = extract_depart_date(lower)
    det_flight, det_train, det_pref = extract_transport_preference(lower)

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

    city = det_dest or (data.get("city") if data.get("city") and match_city(str(data.get("city"))) else None)
    origin_city = det_orig or data.get("origin_city")
    depart_date = det_date or data.get("depart_date")
    pref_transport = det_pref or data.get("transport_preference")

    thematic = match_thematic_destination(safe_message, origin_city=origin_city)
    thematic_category = None
    thematic_title = None
    candidate_cities: list[str] = []
    area_type = None
    if not city and thematic:
        thematic_category = thematic.category
        thematic_title = thematic.title
        candidate_cities = thematic.candidate_cities
        area_type = thematic.area_type

    raw_chips = data.get("disambiguation_suggestions") or []
    if not city and thematic:
        raw_chips = thematic.suggested_chips
    elif not raw_chips or (pref_transport is None and not any("поезд" in c.lower() or "самолет" in c.lower() for c in raw_chips)):
        raw_chips = default_chips(
            lower,
            origin=origin_city,
            city=city,
            transport_pref=pref_transport,
            depart_date=depart_date,
        )

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

    inc_flight = det_flight if det_flight is not None else (True if pref_transport in ("flight", "both") else None)
    inc_train = det_train if det_train is not None else (True if pref_transport in ("train", "both") else None)

    return ExtractedSlots(
        city=city,
        candidate_cities=candidate_cities,
        thematic_category=thematic_category,
        thematic_title=thematic_title,
        area_type=area_type,
        origin_city=origin_city,
        stars=stars,
        max_price_per_night_rub=data.get("max_price_per_night_rub"),
        total_trip_budget_rub=data.get("total_trip_budget_rub"),
        pet_friendly=data.get("pet_friendly"),
        heated_pool=data.get("heated_pool"),
        spa=data.get("spa"),
        breakfast_included=data.get("breakfast_included"),
        free_cancellation=data.get("free_cancellation"),
        guests_count=guests,
        nights=nights,
        arrival_time=data.get("arrival_time"),
        departure_time=data.get("departure_time"),
        needs_late_checkout=data.get("needs_late_checkout"),
        depart_date=depart_date,
        include_flight=inc_flight,
        include_train=inc_train,
        transport_preference=pref_transport,
        semantic_query=data.get("semantic_query") or safe_message,
        disambiguation_suggestions=sanitize_chips(raw_chips),
        intent=data.get("intent") or ("review_inquiry" if re.search(r"ч[её]\s+по\s+отзывам|как\w*\s+(?:там\s+)?отзыв|что\s+.*отзыв|какие\s+минус|какие\s+плюс|репутаци|мнения\s+гостей|выжимк\w*\s+отзыв|расскажи\s+про\s+отзывы|плюсы\s+и\s+минусы", lower) else "search"),
        is_review_inquiry=bool(data.get("is_review_inquiry") or (data.get("intent") == "review_inquiry") or re.search(r"ч[её]\s+по\s+отзывам|как\w*\s+(?:там\s+)?отзыв|что\s+.*отзыв|какие\s+минус|какие\s+плюс|репутаци|мнения\s+гостей|выжимк\w*\s+отзыв|расскажи\s+про\s+отзывы|плюсы\s+и\s+минусы", lower)),
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


# Чипсы быстрого ответа про город отправления (Issue #40, F06 «Только нужные вопросы»).

ORIGIN_CLARIFICATION_CHIPS = ["Из Москвы", "Из Санкт-Петербурга", "Другой город"]


def flag_missing_origin_slots(slots: ExtractedSlots) -> ExtractedSlots:
    """
    Детекция недостающего ключевого слота origin_city (Issue #40).

    Если цель поездки понятна (город назначения или тематика), но город
    отправления неизвестен — выставляется флаг needs_origin_clarification.
    По нему response_generator задает проактивный вопрос про логистику,
    а workflow подменяет чипсы на быстрые ответы с городами.
    """
    destination_known = bool(slots.city or slots.thematic_category or slots.candidate_cities)
    slots.needs_origin_clarification = bool(destination_known and not slots.origin_city)
    return slots

