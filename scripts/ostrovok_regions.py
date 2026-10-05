"""
Реестр направлений парсинга: 20 регионов двумя волнами.
Только данные — загрузка страниц в ostrovok_fetch.py, нормализация в parse_ostrovok_hotels.py.
"""

from typing import Any, Dict, List

# Волна 1: Топ-10 туристических направлений (Цель: ≥ 1200 отелей)
WAVE_1_REGIONS: List[Dict[str, Any]] = [
    {"city": "Москва", "slug": "russia/moscow", "pages": 11, "area_type": "center"},
    {"city": "Санкт-Петербург", "slug": "russia/st._petersburg", "pages": 11, "area_type": "center"},
    {"city": "Сочи", "slug": "russia/sochi", "pages": 11, "area_type": "sea"},
    {"city": "Красная Поляна", "slug": "russia/krasnaya_polyana", "pages": 7, "area_type": "mountains"},
    {"city": "Эсто-Садок", "slug": "russia/esto-sadok", "pages": 6, "area_type": "mountains"},
    {"city": "Казань", "slug": "russia/kazan", "pages": 8, "area_type": "center"},
    {"city": "Калининград", "slug": "russia/kaliningrad", "pages": 7, "area_type": "center"},
    {"city": "Зеленоградск", "slug": "russia/zelenogradsk", "pages": 5, "area_type": "sea"},
    {"city": "Алтай", "slug": "russia/western_siberia_altai_republic_multi", "pages": 6, "area_type": "nature"},
    {"city": "Екатеринбург", "slug": "russia/yekaterinburg", "pages": 7, "area_type": "center"},
]

# Волна 2: Расширение (+1000 отелей)
WAVE_2_REGIONS: List[Dict[str, Any]] = [
    {"city": "Шерегеш", "slug": "russia/sheregesh", "pages": 6, "area_type": "mountains"},
    {"city": "Нижний Новгород", "slug": "russia/nizhniy_novgorod", "pages": 7, "area_type": "center"},
    {"city": "Владивосток", "slug": "russia/vladivostok", "pages": 6, "area_type": "sea"},
    {"city": "Анапа", "slug": "russia/anapa", "pages": 7, "area_type": "sea"},
    {"city": "Геленджик", "slug": "russia/gelendzhik", "pages": 6, "area_type": "sea"},
    {"city": "Иркутск (Байкал)", "slug": "russia/irkutsk", "pages": 6, "area_type": "nature"},
    {"city": "Карелия (Петрозаводск)", "slug": "russia/petrozavodsk", "pages": 6, "area_type": "nature"},
    {"city": "Самара", "slug": "russia/samara", "pages": 6, "area_type": "center"},
    {"city": "Дагестан (Махачкала)", "slug": "russia/makhachkala", "pages": 6, "area_type": "sea"},
    {"city": "Мурманск", "slug": "russia/murmansk", "pages": 5, "area_type": "nature"},
]
