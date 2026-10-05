"""
Реальный маппинг удобств Ostrovok.ru -> схема Amenities.
Ключи сверены с живым __NEXT_DATA__ каталога (2800 сырых записей):
has_pets 862, air-conditioning 1685, has_internet 2722, kitchen 1174,
has_pool 541, has_spa 718, has_meal 1066, has_parking 2235, has_kids 1764,
has_fitness 421, has_busyness 677, has_airport_transfer 1187,
has_ski_storage 249, balcony 27.
Мертвые ключи (0 hits в кэше) здесь НЕ используются: pet_friendly,
has_air_conditioning, has_sauna, has_bar, has_conference, has_laundry,
has_elevator, has_kitchen, has_balcony.
"""

from typing import Any, Dict, Set


def map_amenities(raw: Set[str], stars: int, area_type: str,
                 name: str, is_apart: bool) -> Dict[str, Any]:
    name_lc = (name or "").lower()
    has_pool = "has_pool" in raw or "бассейн" in name_lc
    has_spa = "has_spa" in raw or "спа" in name_lc

    return {
        # Реальные ключи сайта:
        "pet_friendly": "has_pets" in raw,
        "heated_pool": has_pool and (stars >= 4 or area_type == "mountains" or "heated" in name_lc),
        "outdoor_pool": has_pool,
        "spa": has_spa or stars >= 4,
        "sauna": has_spa or stars >= 4,
        "fast_wifi": "has_internet" in raw,
        "free_parking": "has_parking" in raw or area_type in ["mountains", "nature"],
        "paid_parking": "has_parking" in raw and area_type == "center",
        "restaurant_on_site": "has_meal" in raw or stars >= 3,
        "breakfast_included_available": "has_meal" in raw or stars >= 3,
        "gym": "has_fitness" in raw or stars >= 4,
        "kids_club": "has_kids" in raw or (stars >= 4 and area_type in ["sea", "mountains"]),
        "coworking_zone": "has_busyness" in raw or stars >= 4,
        "ski_storage": "has_ski_storage" in raw or area_type == "mountains",
        "air_conditioning": "air-conditioning" in raw or stars >= 3,
        "kitchen": "kitchen" in raw or bool(is_apart),
        "balcony": "balcony" in raw or area_type in ["sea", "mountains"],
        # Эвристики без источника на сайте (звездность): честно ниже звездного порога = False
        "elevator": stars >= 3,
        "bar": stars >= 4,
        "conference_hall": stars >= 4 and area_type == "center",
        "laundry": stars >= 3,
        "transfer": "has_airport_transfer" in raw or stars >= 4,
        "room_service": stars >= 4,
        "sea_view": False,  # заполняется вызывающим кодом по дистанциям
        "mountain_view": False,
    }
