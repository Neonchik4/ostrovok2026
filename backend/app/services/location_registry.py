import json
import os
import re
from typing import List, Dict, Optional, Tuple

_LOCATIONS_CACHE: Optional[List[Dict[str, object]]] = None
_COMPILED_PATTERNS: Optional[List[Tuple[str, List[re.Pattern]]]] = None

def _load_locations_data() -> List[Dict[str, object]]:
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
                with open(abs_p, "r", encoding="utf-8") as f:
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
        {"canonical": "Москва", "patterns": [r"москв\w*", r"мск\b"]},
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
    ]
