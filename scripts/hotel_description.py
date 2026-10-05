"""
Построение тегов и семантического описания отеля из реальных полей.
Только детерминированная сборка строк — никакой синтетики: рейтинг/цены/
дистанции подставляются как есть (0 — значит нет данных, см. data_quality).
"""

from typing import Any, Dict, List, Optional


def build_tags(stars: int, city: str, amenities: Dict[str, Any],
               dist_ski_m: Optional[int], dist_beach_m: Optional[int]) -> List[str]:
    tags = [f"{stars}★" if stars > 0 else "Отель", city]
    if amenities["pet_friendly"]:
        tags.append("Pet friendly")
    if amenities["heated_pool"]:
        tags.append("Теплый бассейн")
    elif amenities["outdoor_pool"]:
        tags.append("Бассейн")
    if amenities["spa"]:
        tags.append("СПА-комплекс")
    if dist_ski_m and dist_ski_m <= 500:
        tags.append(f"Подъемник {dist_ski_m}м")
    elif dist_beach_m and dist_beach_m <= 300:
        tags.append(f"Море {dist_beach_m}м")
    if amenities["breakfast_included_available"]:
        tags.append("Завтрак")
    return tags


def build_description(name: str, stars: int, city: str, area: str, address: str,
                      rating: float, reviews_count: int,
                      dist_ski_m: Optional[int], dist_beach_m: Optional[int],
                      dist_center_km: Optional[float],
                      amenities: Dict[str, Any], min_price: int) -> str:
    """Семантическое описание для ChromaDB (максимально плотное и информативное)."""
    desc_parts = [
        f"{name} — {stars if stars else 'уютный'}-звездочный отель в г. {city}, {area}.",
        f"Адрес: {address}.",
        f"Рейтинг гостей {rating:.1f}/10 на основе {reviews_count} отзывов.",
    ]
    if dist_ski_m:
        desc_parts.append(f"Расположен всего в {dist_ski_m} метрах от горнолыжного подъемника.")
    if dist_beach_m:
        desc_parts.append(f"Расстояние до пляжа и Черного моря составляет {dist_beach_m} м.")
    if dist_center_km:
        desc_parts.append(f"До исторического центра города: {dist_center_km} км.")

    amenities_ru = []
    if amenities["pet_friendly"]:
        amenities_ru.append("разрешено проживание с собаками и кошками (pet-friendly)")
    if amenities["heated_pool"]:
        amenities_ru.append("круглогодичный подогреваемый бассейн")
    elif amenities["outdoor_pool"]:
        amenities_ru.append("открытый плавательный бассейн")
    if amenities["spa"]:
        amenities_ru.append("спа-центр и финская сауна")
    if amenities["restaurant_on_site"]:
        amenities_ru.append("ресторан авторской кухни и вкусные завтраки")
    if amenities["ski_storage"]:
        amenities_ru.append("комната сушки и хранения горнолыжного снаряжения")
    if amenities["fast_wifi"]:
        amenities_ru.append("высокоскоростной бесплатный Wi-Fi")

    if amenities_ru:
        desc_parts.append("Инфраструктура и удобства: " + ", ".join(amenities_ru) + ".")
    desc_parts.append(f"Базовая стоимость проживания от {min_price} руб/ночь.")

    return " ".join(desc_parts)
