import re
from dataclasses import dataclass, field


@dataclass
class ThematicDestination:
    category: str
    title: str
    description: str
    candidate_cities: list[str]
    default_showcase_city: str
    suggested_chips: list[str]
    area_type: str | None = None
    patterns: list[re.Pattern] = field(default_factory=list)


_THEMES: list[ThematicDestination] = [
    ThematicDestination(
        category="warm",
        title="Теплые края и юг России",
        description="Для отдыха в теплых краях отлично подойдут курорты Черноморского побережья и Каспия: Сочи, Анапа, Геленджик или Дагестан.",
        candidate_cities=["Сочи", "Анапа", "Геленджик", "Дагестан (Махачкала)"],
        default_showcase_city="Сочи",
        suggested_chips=["В Сочи", "В Анапу", "В Геленджик", "В Дагестан"],
        area_type="sea",
        patterns=[
            re.compile(r"тепл\w*\s+кра\w*", re.IGNORECASE),
            re.compile(r"\b(?:в\s+|во\s+)?тепл[ое]\b", re.IGNORECASE),
            re.compile(r"\bна\s+юг\w*\b|\bгде\s+тепл\w*", re.IGNORECASE),
            re.compile(r"\bпогре\w+|\bсолнц\w+", re.IGNORECASE),
            re.compile(r"\bюжн\w*\s+курорт\w*", re.IGNORECASE),
        ],
    ),
    ThematicDestination(
        category="sea",
        title="Морские курорты",
        description="Для морского отдыха отлично подойдут курорты Черноморского побережья (Сочи, Анапа, Геленджик), Балтики (Зеленоградск) или Каспия (Дагестан).",
        candidate_cities=["Сочи", "Анапа", "Геленджик", "Зеленоградск", "Дагестан (Махачкала)"],
        default_showcase_city="Сочи",
        suggested_chips=["В Сочи", "В Анапу", "В Геленджик", "В Зеленоградск"],
        area_type="sea",
        patterns=[
            re.compile(r"\b(?:на|к|у)\s+мор[еяю]\b", re.IGNORECASE),
            re.compile(r"\bморск\w*|\bпобережь\w*|\bпляж\w*", re.IGNORECASE),
            re.compile(r"\bкурорт\w*\s+у\s+мор\w*", re.IGNORECASE),
            re.compile(r"\bчерно\w*\s+мор\w*|\bбалти\w*\s+мор\w*|\bкаспи\w*\s+мор\w*", re.IGNORECASE),
        ],
    ),
    ThematicDestination(
        category="mountains",
        title="Горные курорты",
        description="Для отдыха в горах отлично подойдут живописные вершины Красной Поляны, снежные трассы Шерегеша или первозданные горные хребты Алтая.",
        candidate_cities=["Красная Поляна", "Шерегеш", "Алтай"],
        default_showcase_city="Красная Поляна",
        suggested_chips=["Красная Поляна", "В Шерегеш", "На Алтай", "Отель у подъемника"],
        area_type="mountains",
        patterns=[
            re.compile(r"\b(?:в|к|на|у|и)\s+гор[ыахеу]\b|\bгор[ыахеу]\b", re.IGNORECASE),
            re.compile(r"\bгорн\w*|\bвершин\w*", re.IGNORECASE),
            re.compile(r"\bгорнолыжн\w*|\bна\s+лыж\w*|\bкататься\s+на\s+лыж\w*|\bсноуборд\w*", re.IGNORECASE),
            re.compile(r"\bподъемник\w*|\bсклон\w*|\bтрасс\w*", re.IGNORECASE),
        ],
    ),
    ThematicDestination(
        category="nature",
        title="Природа и заповедные места",
        description="Для отдыха на природе прекрасно подойдут побережье Байкала, живописные озера и леса Карелии, дикая природа Алтая или северное сияние в Мурманске.",
        candidate_cities=["Иркутск (Байкал)", "Карелия (Петрозаводск)", "Алтай", "Мурманск"],
        default_showcase_city="Иркутск (Байкал)",
        suggested_chips=["На Байкал", "В Карелию", "На Алтай", "В Мурманск"],
        area_type="nature",
        patterns=[
            re.compile(r"\b(?:на|к)\s+природ\w*|\bприрод\w*|\bэко[- ]отдых\w*", re.IGNORECASE),
            re.compile(r"\b(?:на|к)\s+озер\w*|\bозер\w*|\bтайг\w*|\bзаповедник\w*", re.IGNORECASE),
            re.compile(r"\bсеверн\w*\s+сияни\w*|\bзаполяр\w*", re.IGNORECASE),
        ],
    ),
    ThematicDestination(
        category="culture",
        title="Культурный и городской туризм",
        description="Для познавательного отдыха и экскурсий отлично подойдут музеи Санкт-Петербурга, историческая Казань, купеческий Нижний Новгород или европейский Калининград.",
        candidate_cities=["Санкт-Петербург", "Казань", "Нижний Новгород", "Калининград"],
        default_showcase_city="Санкт-Петербург",
        suggested_chips=["В Санкт-Петербург", "В Казань", "В Нижний Новгород", "В Калининград"],
        area_type="center",
        patterns=[
            re.compile(r"\bэкскурси\w*|\bмузе\w*|\bдостопримечательност\w*", re.IGNORECASE),
            re.compile(r"\bистори\w*\s+(?:город|мест)\w*", re.IGNORECASE),
            re.compile(r"\bпогулять\s+по\s+городу\b|\bкрасивый\s+город\b", re.IGNORECASE),
        ],
    ),
]


def match_thematic_destination(text: str, origin_city: str | None = None) -> ThematicDestination | None:
    """
    Распознает тематический или неточный географический запрос гостя:
    - 'хочу в теплые края россии' -> ThematicDestination(warm)
    - 'хочу на море' -> ThematicDestination(sea)
    - 'хочу в горы' -> ThematicDestination(mountains)
    - 'на природу' -> ThematicDestination(nature)
    """
    if not text:
        return None

    clean = text.lower().strip()
    for theme in _THEMES:
        for pat in theme.patterns:
            if pat.search(clean):
                candidates = [c for c in theme.candidate_cities if not (origin_city and c.lower() == origin_city.lower())]
                chips = [c for c in theme.suggested_chips if not (origin_city and origin_city.lower() in c.lower())]
                default_city = theme.default_showcase_city
                if origin_city and default_city.lower() == origin_city.lower():
                    default_city = candidates[0] if candidates else theme.default_showcase_city

                return ThematicDestination(
                    category=theme.category,
                    title=theme.title,
                    description=theme.description,
                    candidate_cities=candidates,
                    default_showcase_city=default_city,
                    suggested_chips=chips[:4],
                    area_type=theme.area_type,
                )
    return None
