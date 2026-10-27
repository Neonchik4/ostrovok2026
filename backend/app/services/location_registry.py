import json
import os
import re

_LOCATIONS_CACHE: list[dict[str, object]] | None = None
_COMPILED_PATTERNS: list[tuple[str, list[re.Pattern]]] | None = None

def _load_locations_data() -> list[dict[str, object]]:
    """Загружает справочник локаций из locations.json с fallback на встроенный список."""
    candidate_paths = [
        os.path.join(os.path.dirname(__file__), "..", "data", "locations.json"),
        os.path.join(os.path.dirname(__file__), "data", "locations.json"),
        "backend/app/data/locations.json",
        "app/data/locations.json",
        "./outputs/locations.json",
    ]

    for p in candidate_paths:
        abs_p = os.path.abspath(p)
        if os.path.exists(abs_p):
            try:
                with open(abs_p, encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        return data
            except Exception as e:
                print(f"[LocationRegistry Warning] Ошибка чтения {abs_p}: {e}")

    # Встроенный резервный справочник
    return [
        {"canonical": "Красная Поляна", "patterns": [r"красн\w*\s+полян\w*", r"полян\w*"]},
        {"canonical": "Сочи", "patterns": [r"сочи"]},
        {"canonical": "Санкт-Петербург", "patterns": [r"санкт[- ]петербург\w*", r"петербург\w*", r"питер\w*", r"спб\b"]},
        {"canonical": "Москва", "patterns": [r"москв\w*", r"мск\b", r"подмосков\w*", r"красн\w*\s+площад\w*"]},
        {"canonical": "Казань", "patterns": [r"казан\w*"]},
        {"canonical": "Калининград", "patterns": [r"калининград\w*", r"кениг\w*"]},
        {"canonical": "Екатеринбург", "patterns": [r"екатеринбург\w*", r"екб\b", r"екат\w*"]},
        {"canonical": "Нижний Новгород", "patterns": [r"нижн\w*\s+новгород\w*", r"нижн\w*"]},
        {"canonical": "Шерегеш", "patterns": [r"шерегеш\w*", r"геш\w*"]},
        {"canonical": "Алтай", "patterns": [r"алта\w*", r"горно[- ]алтайск\w*"]},
        {"canonical": "Иркутск (Байкал)", "patterns": [r"байкал\w*", r"иркутск\w*"]},
        {"canonical": "Дагестан (Махачкала)", "patterns": [r"дагестан\w*", r"махачкал\w*", r"дербент\w*"]},
        {"canonical": "Карелия (Петрозаводск)", "patterns": [r"карели\w*", r"петрозаводск\w*"]},
        {"canonical": "Владивосток", "patterns": [r"владивосток\w*", r"владик\b"]},
        {"canonical": "Анапа", "patterns": [r"анап\w*"]},
        {"canonical": "Геленджик", "patterns": [r"геленджик\w*"]},
        {"canonical": "Зеленоградск", "patterns": [r"зеленоградск\w*"]},
        {"canonical": "Мурманск", "patterns": [r"мурманск\w*", r"териберк\w*"]},
        {"canonical": "Самара", "patterns": [r"самар\w*"]},
        {"canonical": "Ижевск", "patterns": [r"ижевск\w*", r"удмурти\w*"]},
        {"canonical": "Уфа", "patterns": [r"уф\w*", r"башкири\w*", r"башкортостан\w*"]},
        {"canonical": "Пермь", "patterns": [r"перм\w*"]},
        {"canonical": "Тюмень", "patterns": [r"тюмен\w*"]},
        {"canonical": "Челябинск", "patterns": [r"челябинск\w*", r"челяб\w*"]},
        {"canonical": "Красноярск", "patterns": [r"красноярск\w*", r"краснояр\w*"]},
        {"canonical": "Новосибирск", "patterns": [r"новосибирск\w*", r"новосиб\w*", r"нск\b"]},
        {"canonical": "Омск", "patterns": [r"омск\w*"]},
        {"canonical": "Ростов-на-Дону", "patterns": [r"ростов[- ]на[- ]дону", r"ростов\w*"]},
        {"canonical": "Волгоград", "patterns": [r"волгоград\w*"]},
        {"canonical": "Воронеж", "patterns": [r"воронеж\w*"]},
        {"canonical": "Ярославль", "patterns": [r"ярославл\w*"]},
        {"canonical": "Саратов", "patterns": [r"саратов\w*"]},
    ]

def _init_patterns() -> None:
    global _LOCATIONS_CACHE, _COMPILED_PATTERNS
    if _COMPILED_PATTERNS is not None:
        return

    _LOCATIONS_CACHE = _load_locations_data()
    compiled: list[tuple[str, list[re.Pattern]]] = []

    for item in _LOCATIONS_CACHE:
        canonical = str(item.get("canonical", ""))
        patterns = item.get("patterns", [])
        if not canonical or not isinstance(patterns, list):
            continue

        compiled_for_city: list[re.Pattern] = []
        for pat_str in patterns:
            try:
                # Регистронезависимая компиляция с безопасным поиском
                pat = re.compile(pat_str, re.IGNORECASE)
                compiled_for_city.append(pat)
            except re.error as e:
                print(f"[LocationRegistry Error] Ошибка компиляции regex '{pat_str}': {e}")

        if compiled_for_city:
            compiled.append((canonical, compiled_for_city))

    _COMPILED_PATTERNS = compiled

def get_known_cities() -> list[str]:
    """Возвращает список всех канонических городов из реестра."""
    _init_patterns()
    if not _LOCATIONS_CACHE:
        return []
    return [str(item["canonical"]) for item in _LOCATIONS_CACHE if "canonical" in item]

def match_city(text: str) -> str | None:
    """
    Определяет город по тексту запроса с учетом падежей, склонений и сленговых алиасов.
    Secure by Design: защищен от ReDoS (простые и эффективные regex-шаблоны).
    """
    if not text:
        return None

    _init_patterns()
    if not _COMPILED_PATTERNS:
        return None

    clean_text = text.lower().strip()

    # Сначала ищем по точным и составным совпадениям
    for canonical, pattern_list in _COMPILED_PATTERNS:
        for pat in pattern_list:
            if pat.search(clean_text):
                return canonical

    return None
