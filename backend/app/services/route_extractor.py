import re
from datetime import UTC, datetime, timedelta

from .location_registry import match_city
from .thematic_destinations import match_thematic_destination

_DEST_STOP_WORDS = {
    "центр", "отель", "гостиницу", "номер", "горы", "отпуск", "тур",
    "выходные", "пятницу", "субботу", "воскресенье", "две", "три", "два",
    "ночи", "ночей", "дня", "дней", "неделю", "пару", "семью", "поездку",
    "гости", "на", "с", "по", "к", "для", "январе", "феврале", "марте",
    "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре",
    "теплые", "тепло", "края", "край", "юг", "юга", "море", "пляж", "природу", "природа",
    "лес", "деревню", "горные", "склоны", "россию", "россия", "отдых", "любой", "хороший",
    "недорогой", "дешевый", "озера", "озеро", "тайгу", "тайга", "экскурсии",
}
_ORIG_STOP_WORDS = {"дома", "отеля", "аэропорта", "вокзала", "города", "нас", "центра", "собакой", "бассейном", "завтраком"}

_ORIG_PAT = re.compile(
    r"(?:\b(?:из|изо|откуда\s*:?|(?:вылет|выезд|старт|отправление)\s+(?:из|с|со)|"
    r"(?:буду\s+)?(?:лететь|лечу|полечу|ехать|еду|поеду|отправлюсь)\s+(?:из|с|со)|"
    r"(?:билеты|рейс|поезд|самолет)\s+(?:из|с|со)))\s+([а-яё\-]+(?:\s+[а-яё\-]+)?)",
    re.IGNORECASE,
)
_DEST_PAT = re.compile(
    r"(?:\bкуда\s*:?|\bпоездка\s+(?:в|во|на)\b|\bбилеты\s+(?:в|во|на)\b|\bв\b|\bво\b|\bдо\b|\bна\b)\s+([а-яё\-]+(?:\s+(?!(?:в|во|на|до|из|с|со|по|для|от|к)\b)[а-яё\-]+)?)",
    re.IGNORECASE,
)


def sanitize_chips(chips: list[str]) -> list[str]:
    """Secure by Design: проверка аномалий в чипсах."""
    sanitized: list[str] = []
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


def default_chips(
    lower: str,
    origin: str | None = None,
    city: str | None = None,
    transport_pref: str | None = None,
    depart_date: str | None = None,
    thematic_category: str | None = None,
) -> list[str]:
    """Генерация персонализированных быстрых уточнений: тематические направления, транспорт, даты, бюджет и удобства."""
    chips: list[str] = []

    # 0. Если направление не зафиксировано, но распознана тематика (теплые края, море, горы, природа)
    thematic = match_thematic_destination(lower, origin_city=origin)
    if not city and thematic:
        chips.extend(thematic.suggested_chips)

    # 1. Если город отправления не указан и нет указания в тексте
    if not origin and "вылет" not in lower and "выезд" not in lower and "из " not in lower and "с " not in lower:
        if city == "Москва":
            chips.append("Выезд из СПб")
            chips.append("Вылет из Казани")
        else:
            chips.append("Вылет из Москвы")
            chips.append("Выезд из СПб")

    # 2. Выбор транспорта (поезд или самолет)
    if not transport_pref and "поезд" not in lower and "самолет" not in lower and "авиа" not in lower:
        chips.append("Хочу на поезде")
        chips.append("На самолете")

    # 3. Даты поездки
    if not depart_date and not re.search(r"\bсегодня\b|\bзавтра\b|\bпослезавтра\b|\bвыходн\w*|\bнедел\w*|\b\d{1,2}[./]\d{1,2}\b", lower):
        chips.append("В эти выходные")

    # 4. Бюджет
    if "бюджет" not in lower and "цена" not in lower and "руб" not in lower and "000" not in lower:
        chips.append("Бюджет до 50 000 ₽")
        chips.append("До 10 000 ₽ / ночь")

    # 5. Удобства отеля
    if "завтрак" not in lower:
        chips.append("Только с завтраком")
    if "бассейн" not in lower:
        chips.append("С теплым бассейном")
    if "вид" not in lower and "гор" not in lower:
        chips.append("С видом на горы")
    if "отмен" not in lower and "cancel" not in lower:
        chips.append("Свободная отмена")
    return sanitize_chips(chips)[:4]


def extract_route_cities(text: str) -> tuple[str | None, str | None]:
    """
    Интеллектуальное извлечение пунктов отправления и назначения из запроса:
    - 'я буду лететь с анапы' -> ('Анапа', None)
    - 'я полечу с анапы в питер' -> ('Анапа', 'Санкт-Петербург')
    - 'из Самары в Сочи' -> ('Самара', 'Сочи')
    - 'Москва - Казань' -> ('Москва', 'Казань')
    - 'хочу в Сочи' -> (None, 'Сочи')
    - 'хочу в теплые края россии' -> (None, None) (не выдумывает город 'Теплые')
    """
    lower = text.lower()
    orig = None
    dest = None

    # 1. Формат 'Город1 - Город2' или 'Город1 -> Город2'
    m_dash = re.search(r"([а-яё\-]+(?:\s+[а-яё\-]+)?)\s*(?:-|->|—)\s*([а-яё\-]+(?:\s+[а-яё\-]+)?)", lower)
    if m_dash:
        c1 = match_city(m_dash.group(1))
        c2 = match_city(m_dash.group(2))
        if c1 and c2 and c1 != c2:
            return c1, c2

    # 1.5. Формат 'с Город1 в Город2'
    m_s_v = re.search(r"\bс\s+([а-яё\-]+)\s+(?:в|во|до)\s+([а-яё\-]+)", lower)
    if m_s_v:
        c1 = match_city(m_s_v.group(1))
        c2 = match_city(m_s_v.group(2))
        if c1 and c2 and c1 != c2:
            return c1, c2

    # 2. Пункт отправления (из, вылет из, лететь с ...)
    # Исключаем локальный трансфер из аэропорта/вокзала города назначения
    from_text = re.sub(r"\bтрансфер\s+(?:из|от|с|до)\s+[^.\n]+", " ", lower)
    m_from = _ORIG_PAT.search(from_text)
    if m_from:
        raw_from = m_from.group(1).strip()
        matched_orig = match_city(raw_from)
        if not matched_orig and " " in raw_from and not raw_from.startswith(("аэропорт", "вокзал")):
            for part in raw_from.split():
                matched_orig = match_city(part)
                if matched_orig:
                    break
        if matched_orig:
            orig = matched_orig
        else:
            w1 = raw_from.split()[0]
            if w1 not in _ORIG_STOP_WORDS and len(w1) >= 4 and re.search(r"\b(?:из|изо)\s+" + re.escape(w1), lower):
                # Только надежные существительные после 'из/изо'
                orig = w1.capitalize()

    # 3. Пункт назначения (куда, в, во, до, на, поездка в, билеты в)
    for m_to in _DEST_PAT.finditer(lower):
        raw_to = m_to.group(1).strip()
        matched = match_city(raw_to)
        if not matched and " " in raw_to:
            for part in raw_to.split():
                matched = match_city(part)
                if matched:
                    break
        if matched and matched != orig:
            dest = matched
            break

    # 4. Если пункт назначения не найден по предлогам и пункт отправления НЕ был единственным городом
    if not dest and not orig:
        found = match_city(lower)
        if found:
            dest = found

    return orig, dest


_RU_MONTHS = {
    "янв": 1, "фев": 2, "мар": 3, "апр": 4, "май": 5, "мае": 5, "мая": 5,
    "июн": 6, "июл": 7, "авг": 8, "сен": 9, "окт": 10, "ноя": 11, "дек": 12,
}
_MONTH_PAT = r"(?:янв\w*|фев\w*|мар\w*|апр\w*|ма[еяй]\w*|июн\w*|июл\w*|авг\w*|сен\w*|окт\w*|ноя\w*|дек\w*)"


def _match_ru_month(word: str) -> int | None:
    w = word.lower()
    for prefix, m_num in _RU_MONTHS.items():
        if w.startswith(prefix) or prefix in w:
            return m_num
    return None


def extract_trip_dates(text: str) -> tuple[str | None, int | None]:
    """
    Извлечение даты заезда и продолжительности поездки (ночей):
    - Одиночные даты, относительные дни ('сегодня', 'завтра');
    - Диапазоны дат в одном месяце ('с 10 по 15 июля');
    - Диапазоны дат через границу месяцев ('с 28 февраля по 5 марта', '25 ноября — 1 декабря');
    - Диапазоны через Новый год ('с 30 декабря 2026 по 5 января 2027', 'с 30 декабря по 5 января 2027').
    Возвращает (depart_date, nights).
    """
    lower = re.sub(r"\b24/7\b", " ", text.lower())
    now = datetime.now(UTC)

    if re.search(r"\bсегодня\b|\bна\s+сегодня\b", lower):
        return now.strftime("%Y-%m-%d"), None
    if re.search(r"\bзавтра\b|\bна\s+завтра\b", lower):
        return (now + timedelta(days=1)).strftime("%Y-%m-%d"), None
    if re.search(r"\bпослезавтра\b|\bна\s+послезавтра\b", lower):
        return (now + timedelta(days=2)).strftime("%Y-%m-%d"), None

    # 1. Диапазон числовых дат (например: 'с 25.11 по 01.12', '25.11 - 01.12')
    num_matches = list(re.finditer(r"\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b", lower))
    if len(num_matches) >= 2:
        d1, m1 = int(num_matches[0].group(1)), int(num_matches[0].group(2))
        y1_raw = int(num_matches[0].group(3)) if num_matches[0].group(3) else None
        d2, m2 = int(num_matches[1].group(1)), int(num_matches[1].group(2))
        y2_raw = int(num_matches[1].group(3)) if num_matches[1].group(3) else None
        if 1 <= m1 <= 12 and 1 <= m2 <= 12 and 1 <= d1 <= 31 and 1 <= d2 <= 31:
            if y1_raw and y1_raw < 100:
                y1_raw += 2000
            if y2_raw and y2_raw < 100:
                y2_raw += 2000
            if y1_raw and y2_raw:
                y1, y2 = y1_raw, y2_raw
            elif y1_raw and not y2_raw:
                y1 = y1_raw
                y2 = y1 + 1 if m2 < m1 else y1
            elif not y1_raw and y2_raw:
                y2 = y2_raw
                y1 = y2 - 1 if m2 < m1 else y2
            else:
                y1 = now.year if m1 >= now.month else now.year + 1
                y2 = y1 + 1 if m2 < m1 else y1
            try:
                dt1 = datetime(y1, m1, d1, tzinfo=UTC)
                dt2 = datetime(y2, m2, d2, tzinfo=UTC)
                if dt2 > dt1:
                    return dt1.strftime("%Y-%m-%d"), (dt2 - dt1).days
            except ValueError:
                pass

    # 2. Диапазон с 'и' или запятой: '18 и 19 сентября 2026', '20, 21, 22 сентября'
    m_range_and = re.search(
        rf"\b(\d{{1,2}})\s*(?:и|,)\s*(?:\d{{1,2}}\s*(?:и|,)\s*)*(\d{{1,2}})\s+({_MONTH_PAT})(?:\s+(\d{{4}}))?",
        lower,
    )
    if m_range_and:
        d1 = int(m_range_and.group(1))
        d_last = int(m_range_and.group(2))
        m2 = _match_ru_month(m_range_and.group(3))
        opt_y = int(m_range_and.group(4)) if m_range_and.group(4) else None
        m_yr = re.search(r"\b(202[5-9]|203[0-9])\b", lower)
        y_text = opt_y or (int(m_yr.group(1)) if m_yr else None)
        y2 = y_text or (now.year if (m2 and m2 >= now.month) else now.year + 1)
        if d1 <= d_last:
            m1, y1 = m2, y2
        else:
            if m2 == 1:
                m1, y1 = 12, y2 - 1
            else:
                m1, y1 = m2 - 1, y2
        if m1 and m2 and 1 <= d1 <= 31 and 1 <= d_last <= 31:
            try:
                dt1 = datetime(y1, m1, d1, tzinfo=UTC)
                dt2 = datetime(y2, m2, d_last, tzinfo=UTC)
                if dt2 > dt1:
                    return dt1.strftime("%Y-%m-%d"), (dt2 - dt1).days
            except ValueError:
                pass

    # 3. Диапазон с явным месяцем у конца: 'с 10 по 15 июля', 'с 25 по 1 декабря', 'с 28 по 5 марта'
    m_range_short = re.search(
        rf"(?:с|от|даты:?)\s+(\d{{1,2}})\s*(?:по|до|-|—)\s*(\d{{1,2}})\s+({_MONTH_PAT})(?:\s+(\d{{4}}))?",
        lower,
    )
    if m_range_short:
        d1 = int(m_range_short.group(1))
        d2 = int(m_range_short.group(2))
        m2 = _match_ru_month(m_range_short.group(3))
        opt_y = int(m_range_short.group(4)) if m_range_short.group(4) else None
        m_yr = re.search(r"\b(202[5-9]|203[0-9])\b", lower)
        y_text = opt_y or (int(m_yr.group(1)) if m_yr else None)
        y2 = y_text or (now.year if (m2 and m2 >= now.month) else now.year + 1)
        if d1 <= d2:
            m1 = m2
            y1 = y2
        else:
            if m2 == 1:
                m1 = 12
                y1 = y2 - 1
            else:
                m1 = m2 - 1
                y1 = y2
        if m1 and m2 and 1 <= d1 <= 31 and 1 <= d2 <= 31:
            try:
                dt1 = datetime(y1, m1, d1, tzinfo=UTC)
                dt2 = datetime(y2, m2, d2, tzinfo=UTC)
                if dt2 > dt1:
                    return dt1.strftime("%Y-%m-%d"), (dt2 - dt1).days
            except ValueError:
                pass

    # 4. Поиск всех вхождений 'число месяц [год]' в тексте (например: 'с 25 ноября по 1 декабря', 'с 30 декабря по 5 января 2027')
    date_matches = list(re.finditer(rf"\b(\d{{1,2}})\s+({_MONTH_PAT})(?:\s+(\d{{4}}))?", lower))
    if len(date_matches) >= 2:
        dm1, dm2 = date_matches[0], date_matches[1]
        d1 = int(dm1.group(1))
        m1 = _match_ru_month(dm1.group(2))
        opt_y1 = int(dm1.group(3)) if dm1.group(3) else None
        d2 = int(dm2.group(1))
        m2 = _match_ru_month(dm2.group(2))
        opt_y2 = int(dm2.group(3)) if dm2.group(3) else None

        if opt_y1 and opt_y2:
            y1, y2 = opt_y1, opt_y2
        elif opt_y1 and not opt_y2:
            y1 = opt_y1
            y2 = y1 + 1 if (m2 and m1 and m2 < m1) else y1
        elif not opt_y1 and opt_y2:
            y2 = opt_y2
            y1 = y2 - 1 if (m2 and m1 and m2 < m1) else y2
        else:
            m_yr = re.search(r"\b(202[5-9]|203[0-9])\b", lower)
            y_in_text = int(m_yr.group(1)) if m_yr else None
            if y_in_text:
                if m2 and m1 and m2 < m1:
                    if y_in_text == now.year:
                        y1, y2 = y_in_text, y_in_text + 1
                    else:
                        y1, y2 = y_in_text - 1, y_in_text
                else:
                    y1, y2 = y_in_text, y_in_text
            else:
                y1 = now.year if (m1 and m1 >= now.month) else now.year + 1
                y2 = y1 + 1 if (m2 and m1 and m2 < m1) else y1

        if m1 and m2 and 1 <= d1 <= 31 and 1 <= d2 <= 31:
            try:
                dt1 = datetime(y1, m1, d1, tzinfo=UTC)
                dt2 = datetime(y2, m2, d2, tzinfo=UTC)
                if dt2 > dt1:
                    return dt1.strftime("%Y-%m-%d"), (dt2 - dt1).days
            except ValueError:
                pass

    # 5. Одиночная дата с месяцем: '15 декабря в Казань'
    if len(date_matches) == 1:
        dm = date_matches[0]
        d1 = int(dm.group(1))
        m1 = _match_ru_month(dm.group(2))
        opt_y1 = int(dm.group(3)) if dm.group(3) else None
        m_yr = re.search(r"\b(202[5-9]|203[0-9])\b", lower)
        y1 = opt_y1 or (int(m_yr.group(1)) if m_yr else (now.year if (m1 and m1 >= now.month) else now.year + 1))
        if m1 and 1 <= d1 <= 31:
            try:
                return datetime(y1, m1, d1, tzinfo=UTC).strftime("%Y-%m-%d"), None
            except ValueError:
                pass

    # 6. Одиночная дата в числовом формате (например: '15.03', '15.03.2026')
    if len(num_matches) == 1:
        d = int(num_matches[0].group(1))
        m = int(num_matches[0].group(2))
        y_raw = int(num_matches[0].group(3)) if num_matches[0].group(3) else None
        if y_raw and y_raw < 100:
            y_raw += 2000
        y = y_raw or (now.year if m >= now.month else now.year + 1)
        if 1 <= m <= 12 and 1 <= d <= 31:
            try:
                return datetime(y, m, d, tzinfo=UTC).strftime("%Y-%m-%d"), None
            except ValueError:
                pass

    # 7. Диапазоны дат без указания месяца: 'с 28 по 30', 'с 28 по 2'
    m_range = re.search(r"(?:с|от)\s*(\d{1,2})\s*(?:по|до|-|—)\s*(\d{1,2})", lower)
    if m_range:
        d1 = int(m_range.group(1))
        d2 = int(m_range.group(2))
        if 1 <= d1 <= 31 and 1 <= d2 <= 31:
            try:
                if d1 <= d2:
                    month = now.month if d1 >= now.day - 2 else (now.month + 1 if now.month < 12 else 1)
                    year = now.year if (month >= now.month) else now.year + 1
                    dt1 = datetime(year, month, d1, tzinfo=UTC)
                    return dt1.strftime("%Y-%m-%d"), (d2 - d1)
                else:
                    month1 = now.month if d1 >= now.day - 2 else (now.month + 1 if now.month < 12 else 1)
                    year1 = now.year if (month1 >= now.month) else now.year + 1
                    month2 = month1 + 1 if month1 < 12 else 1
                    year2 = year1 if month1 < 12 else year1 + 1
                    dt1 = datetime(year1, month1, d1, tzinfo=UTC)
                    dt2 = datetime(year2, month2, d2, tzinfo=UTC)
                    if dt2 > dt1:
                        return dt1.strftime("%Y-%m-%d"), (dt2 - dt1).days
            except ValueError:
                pass

    return None, None


def extract_depart_date(text: str) -> str | None:
    """Извлечение даты поездки: сегодня, завтра, послезавтра, точные даты и диапазоны (с 28 по 30)."""
    depart_date, _ = extract_trip_dates(text)
    return depart_date


def extract_transport_preference(text: str) -> tuple[bool | None, bool | None, str | None]:
    """
    Распознавание предпочтения транспорта: поезд, самолет или оба.
    Возвращает (include_flight, include_train, preference: 'train' | 'flight' | 'both')
    """
    lower = text.lower()
    has_train = bool(re.search(r"\bпоезд(?:а|у|ом|е|ов|ам|ами|ах)?\b|\bж/?д\b|\bржд\b|\bэлектричк\w*|\bласточк\w*", lower))
    has_flight = bool(re.search(r"\bсамолет\w*|\bавиа\w*|\bперелет\w*|\bполет\w*|\bлечу\b|\bлететь\b|\bполечу\b|\bрейс\w*", lower))

    if has_train and not has_flight:
        return False, True, "train"
    if has_flight and not has_train:
        return True, False, "flight"
    if has_train and has_flight:
        return True, True, "both"
    return None, None, None
