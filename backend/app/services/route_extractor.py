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
    r"(?:билеты|рейс|поезд|самолет)\s+(?:из|с|со)|с|со))\s+([а-яё\-]+(?:\s+[а-яё\-]+)?)",
    re.IGNORECASE,
)
_DEST_PAT = re.compile(
    r"(?:\bкуда\s*:?|\bпоездка\s+(?:в|во|на)\b|\bбилеты\s+(?:в|во|на)\b|\bв\b|\bво\b|\bдо\b|\bна\b)\s*([а-яё\-]+(?:\s+[а-яё\-]+)?)",
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

    # 2. Пункт отправления (из, с, со, вылет из, лететь с ...)
    m_from = _ORIG_PAT.search(lower)
    if m_from:
        raw_from = m_from.group(1).strip()
        matched_orig = match_city(raw_from)
        if not matched_orig and " " in raw_from:
            for part in raw_from.split():
                matched_orig = match_city(part)
                if matched_orig:
                    break
        if matched_orig:
            orig = matched_orig
        else:
            w1 = raw_from.split()[0]
            if w1 not in _ORIG_STOP_WORDS and len(w1) >= 4 and not lower.startswith("с " + w1):
                # Только надежные существительные не из стоп-слов
                orig = w1.capitalize()

    # 3. Пункт назначения (куда, в, во, до, на, поездка в, билеты в)
    m_to = _DEST_PAT.search(lower)
    if m_to:
        raw_to = m_to.group(1).strip()
        matched = match_city(raw_to)
        if not matched and " " in raw_to:
            for part in raw_to.split():
                matched = match_city(part)
                if matched:
                    break
        if matched and matched != orig:
            dest = matched

    # 4. Если пункт назначения не найден по предлогам и пункт отправления НЕ был единственным городом
    if not dest and not orig:
        found = match_city(lower)
        if found:
            dest = found

    return orig, dest


def extract_depart_date(text: str) -> str | None:
    """Извлечение даты поездки из запроса: сегодня, завтра, послезавтра или точная дата."""
    lower = text.lower()
    now = datetime.now(UTC)
    if re.search(r"\bсегодня\b|\bна\s+сегодня\b", lower):
        return now.strftime("%Y-%m-%d")
    if re.search(r"\bзавтра\b|\bна\s+завтра\b", lower):
        return (now + timedelta(days=1)).strftime("%Y-%m-%d")
    if re.search(r"\bпослезавтра\b|\bна\s+послезавтра\b", lower):
        return (now + timedelta(days=2)).strftime("%Y-%m-%d")

    m_date = re.search(r"\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b", lower)
    if m_date:
        d = int(m_date.group(1))
        m = int(m_date.group(2))
        y = int(m_date.group(3)) if m_date.group(3) else now.year
        if y < 100:
            y += 2000
        try:
            return datetime(y, m, d, tzinfo=UTC).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def extract_transport_preference(text: str) -> tuple[bool | None, bool | None, str | None]:
    """
    Распознавание предпочтения транспорта: поезд, самолет или оба.
    Возвращает (include_flight, include_train, preference: 'train' | 'flight' | 'both')
    """
    lower = text.lower()
    has_train = bool(re.search(r"\bпоезд|\bпоездом|\bпоезде|\bж/?д\b|\bржд\b|\bэлектричк", lower))
    has_flight = bool(re.search(r"\bсамолет|\bавиа|\bперелет|\bполет|\bлечу\b|\bлететь\b|\bполечу\b|\bрейс", lower))

    if has_train and not has_flight:
        return False, True, "train"
    if has_flight and not has_train:
        return True, False, "flight"
    if has_train and has_flight:
        return True, True, "both"
    return None, None, None
