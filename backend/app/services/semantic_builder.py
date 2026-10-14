"""Semantic text representation builder for rich 768-dim hotel embeddings."""
from typing import Dict, Any, Union
from ..schemas.hotel_models import HotelFullSchema


def build_hotel_semantic_document(hotel: Union[HotelFullSchema, Dict[str, Any]]) -> str:
    """
    Формирует структурированное глубокое текстовое представление отеля
    для семантического поиска через paraphrase-multilingual-mpnet-base-v2 (768d).
    """
    if isinstance(hotel, HotelFullSchema):
        data = hotel.model_dump()
    elif isinstance(hotel, dict):
        data = hotel
    else:
        data = getattr(hotel, "__dict__", {})

    parts = []

    # 1. Заголовок и локация
    name = data.get("name", "Отель")
    stars = data.get("stars", 0)
    city = data.get("city", "")
    area = data.get("area", "")
    address = data.get("address", "")
    stars_str = f"{stars}-звездочный отель" if stars > 0 else "Отель"
    parts.append(f"{name} — {stars_str} в городе {city}, район {area}. Адрес: {address}.")

    # 2. Рейтинг и ценовая категория
    rating = data.get("rating", 0.0)
    reviews_count = data.get("reviews_count", 0)
    min_price = data.get("min_price_per_night_rub", 0)
    if rating:
        parts.append(f"Оценка гостей: {rating:.1f}/10 на основе {reviews_count} отзывов. Стоимость номера от {min_price} руб/ночь.")

    # 3. Расстояния до ключевых объектов (пляж, подъемник, центр, метро)
    loc = data.get("location_details") or {}
    dist_parts = []
    if loc.get("distance_to_beach_m"):
        dist_parts.append(f"до моря и пляжа {loc['distance_to_beach_m']} метров")
    if loc.get("distance_to_ski_lift_m"):
        dist_parts.append(f"до горнолыжного подъемника {loc['distance_to_ski_lift_m']} метров")
    if loc.get("distance_to_center_km"):
        dist_parts.append(f"до центра {loc['distance_to_center_km']} км")
    if loc.get("nearest_metro_or_station"):
        dist_parts.append(f"рядом метро/станция {loc['nearest_metro_or_station']}")
    if dist_parts:
        parts.append("Локация: " + ", ".join(dist_parts) + ".")

    # 4. Удобства и инфраструктура
    amenities = data.get("amenities") or {}
    amenity_items = []
    if amenities.get("pet_friendly"):
        amenity_items.append("разрешено проживание с животными (pet-friendly)")
    if amenities.get("heated_pool"):
        amenity_items.append("подогреваемый бассейн")
    elif amenities.get("outdoor_pool"):
        amenity_items.append("открытый бассейн")
    if amenities.get("spa"):
        amenity_items.append("спа-центр")
    if amenities.get("sauna"):
        amenity_items.append("сауна и баня")
    if amenities.get("free_parking"):
        amenity_items.append("бесплатная парковка")
    if amenities.get("fast_wifi"):
        amenity_items.append("быстрый бесплатный Wi-Fi")
    if amenities.get("restaurant_on_site"):
        amenity_items.append("ресторан на территории")
    if amenities.get("ski_storage"):
        amenity_items.append("комната для хранения лыж и сноубордов")
    if amenities.get("gym"):
        amenity_items.append("тренажерный зал")
    if amenity_items:
        parts.append("Инфраструктура и сервисы: " + ", ".join(amenity_items) + ".")

    # 5. Политика размещения питомцев
    policies = data.get("policies") or {}
    pets = policies.get("pets") or {}
    if pets.get("allowed") or amenities.get("pet_friendly"):
        pet_details = ["Проживание с питомцами: разрешено"]
        if pets.get("max_weight_kg"):
            pet_details.append(f"вес до {pets['max_weight_kg']} кг")
        if pets.get("deposit_rub"):
            pet_details.append(f"залог {pets['deposit_rub']} руб")
        if pets.get("daily_fee_rub"):
            pet_details.append(f"доплата {pets['daily_fee_rub']} руб/сутки")
        parts.append("; ".join(pet_details) + ".")

    # 6. Типы номеров
    room_types = data.get("room_types") or []
    if room_types:
        room_names = [r.get("name") for r in room_types[:5] if r.get("name")]
        if room_names:
            parts.append("Категории номеров: " + ", ".join(room_names) + ".")

    # 7. Выжимка отзывов (плюсы и минусы)
    reviews_summary = data.get("reviews_summary") or {}
    positive = reviews_summary.get("positive_highlights") or []
    if positive:
        parts.append("Преимущества по отзывам: " + "; ".join(positive[:3]) + ".")

    description = data.get("description")
    if description:
        parts.append(description[:300])

    return "\n".join(parts)
