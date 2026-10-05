"""
ETL Parser for Ostrovok.ru
Собирает реальные отели через SSR-каталог Ostrovok.ru, нормализует их под схему HotelFullSchema
и сохраняет в outputs/hotels_dataset.json.
Включает кеширование страниц в outputs/raw_ostrovok/ для отказоустойчивости.
"""

import os
import sys
import json
import logging
from typing import Dict, List, Any, Optional
import httpx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from amenity_map import map_amenities
from hotel_description import build_description, build_tags
from ostrovok_fetch import fetch_page_cached
from ostrovok_regions import WAVE_1_REGIONS, WAVE_2_REGIONS
from room_inventory import build_policies, build_room_types

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ostrovok_parser")

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs", "raw_ostrovok")
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs", "hotels_dataset.json")


def normalize_hotel(h: Dict[str, Any], city_cfg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Преобразует сырой объект отеля Островка в схему HotelFullSchema."""
    hotel_id = str(h.get("id") or h.get("masterId") or "")
    name = h.get("name")
    if not hotel_id or not name:
        return None

    city = city_cfg["city"]
    stars = int(h.get("stars") or 0)
    # Доказано: 71 отель без rating/numReviews получал random(15,80).
    # Честно: 0 + флаг has_real_rating=false вместо выдуманного счета.
    raw_rating = h.get("rating") or h.get("taRating")
    rating = float(raw_rating) if raw_rating else 0.0
    raw_reviews = h.get("numReviews") or h.get("taNumReviews")
    reviews_count = int(raw_reviews) if raw_reviews else 0
    has_real_rating = bool(raw_rating and raw_reviews)

    # Локация
    loc = h.get("location") or {}
    lat = loc.get("latitude")
    lon = loc.get("longitude")
    address = loc.get("address") or f"{city}, Россия"

    # Базовая цена: только реальный amount. Доказано сверкой: 2666/2666 цен
    # датасета совпадают с сырым кэшем — ветка выдуманной сетки мертва.
    # Вместо нее: 0 + флаг has_real_prices=false (фильтры такой отель по бюджету отсекают).
    rate_info = h.get("datelessRate") or h.get("datefullRate") or {}
    raw_amount = rate_info.get("amount")
    has_real_price = bool(raw_amount and raw_amount > 500)
    min_price = int(round(raw_amount)) if has_real_price else 0

    # Определение area_type и расстояний
    nearest_beaches = h.get("nearestBeaches") or []
    nearest_ski_lifts = h.get("nearestSkiLifts") or []
    nearest_subways = h.get("nearestSubways") or []

    dist_beach_m = nearest_beaches[0].get("distance") if nearest_beaches else None
    dist_ski_m = nearest_ski_lifts[0].get("distance") if nearest_ski_lifts else None
    dist_center_m = h.get("searchRegionCenterDistance")
    dist_center_km = round(dist_center_m / 1000.0, 1) if dist_center_m is not None else None

    area_type = city_cfg["area_type"]
    if nearest_ski_lifts:
        area_type = "mountains"
    elif nearest_beaches and dist_beach_m and dist_beach_m <= 3000:
        area_type = "sea"

    area = (
        (h.get("region", {}) or {}).get("locativeWhere") or
        (nearest_subways[0].get("name") if nearest_subways else None) or
        ("Центр" if dist_center_km and dist_center_km <= 3.0 else "Район курорта")
    )
    if area.startswith("г. "):
        area = area[3:]

    # Удобства: только реальные ключи __NEXT_DATA__ (см. amenity_map.py).
    # Доказано: код проверял 'pet_friendly'/'has_air_conditioning' (0 hits в кэше),
    # реальные ключи — 'has_pets' (862) и 'air-conditioning' (1685).
    raw_amenities = set(h.get("amenities") or [])
    amenities = map_amenities(raw_amenities, stars, area_type, name, bool(h.get("isApartLike")))
    amenities["sea_view"] = area_type == "sea" and (dist_beach_m or 9999) < 800
    amenities["mountain_view"] = area_type == "mountains"

    # Изображения Островка (размер 640x400)
    raw_images = h.get("images") or []
    image_urls = []
    for img in raw_images[:6]:
        tmpl = img.get("tmpl") or img.get("relativePath")
        if tmpl and "{size}" in tmpl:
            image_urls.append(tmpl.replace("{size}", "640x400"))
        elif tmpl and tmpl.startswith("http"):
            image_urls.append(tmpl)

    # Доказано: unsplash-заглушка у 2 отелей. Честно: [] — фронт подставит
    # локальный /hotels/{category}.jpg, слайды из сети не выдумываем.

    # Номера и политики: деривативы (см. room_inventory.py).
    room_types = build_room_types(hotel_id, min_price, stars, amenities, area_type, image_urls)
    policies = build_policies(hotel_id, stars, min_price, bool(amenities["pet_friendly"]))

    # Теги и описание из реальных полей (см. hotel_description.py).
    tags = build_tags(stars, city, amenities, dist_ski_m, dist_beach_m)
    description = build_description(
        name, stars, city, area, address, rating, reviews_count,
        dist_ski_m, dist_beach_m, dist_center_km, amenities, min_price,
    )

    poi_beaches = [{"name": b.get("name", "Пляж"), "distance_m": b.get("distance", 0)} for b in nearest_beaches[:3]]
    poi_ski = [{"name": s.get("name", "Подъемник"), "distance_m": s.get("distance", 0)} for s in nearest_ski_lifts[:3]]
    poi_subways = [{"name": sub.get("name", "Метро"), "distance_m": sub.get("distance", 0)} for sub in nearest_subways[:3]]

    return {
        "id": hotel_id,
        "name": name,
        "city": city,
        "stars": stars,
        "area": area,
        "area_type": area_type,
        "address": address,
        "min_price_per_night_rub": min_price,
        "rating": rating,
        "reviews_count": reviews_count,
        "location_details": {
            "distance_to_center_km": dist_center_km,
            "distance_to_beach_m": dist_beach_m,
            "distance_to_ski_lift_m": dist_ski_m,
            "nearest_metro_or_station": nearest_subways[0].get("name") if nearest_subways else None,
            "distance_to_transport_m": nearest_subways[0].get("distance") if nearest_subways else None,
            "nearest_beaches": poi_beaches,
            "nearest_ski_lifts": poi_ski,
            "nearest_subways": poi_subways,
        },
        "amenities": amenities,
        "room_types": room_types,
        "policies": policies,
        "tags": tags[:5],
        # Отзывы сюда НЕ пишем: доказано, константа+шаблон. Пусто + флаги,
        # реальные тексты накладывает scripts/build_hotels_json.py из шардов.
        "reviews_summary": {
            "score_cleanliness": 0.0,
            "score_location": 0.0,
            "score_service": 0.0,
            "score_value_for_money": 0.0,
            "score_wifi": 0.0,
            "positive_highlights": [],
            "negative_highlights": [],
            "valid_reviews_count": 0,
            "traveller_distribution": {},
        },
        "top_reviews": [],
        "total_ostrovok_reviews": 0,
        "data_quality": {
            "has_real_reviews": False,
            "has_real_prices": has_real_price,
            "has_real_rating": has_real_rating,
            "rooms_derived": True,
            "policies_derived": True,
        },
        "description": description,
        "image_urls": image_urls,
        "coordinates": {"lat": lat or 55.75, "lon": lon or 37.61} if lat and lon else None,
        "master_id": h.get("masterId"),
        "slug": h.get("regionCatalogSlug"),
        "hotel_kind": h.get("kind") or "HOTEL",
        "is_apart_like": bool(h.get("isApartLike")),
        "is_guru_hotel": bool(h.get("isGuruHotel")),
        "promo_cashback": h.get("promoCashback"),
        "ta_rating": h.get("taRating"),
        "ta_num_reviews": h.get("taNumReviews"),
        "region_id": (h.get("region") or {}).get("id"),
        "region_name": (h.get("region") or {}).get("name"),
        "country_name": "Россия",
        "country_code": "RU",
        "search_region_center_distance_m": dist_center_m,
    }

def run_parser(regions: List[Dict[str, Any]], target_file: str) -> List[Dict[str, Any]]:
    """Выполняет сбор данных по заданным регионам с сохранением в JSON."""
    client = httpx.Client(timeout=20.0)
    all_hotels: Dict[str, Dict[str, Any]] = {}

    total_pages = sum(r["pages"] for r in regions)
    logger.info(f"Старт сбора: {len(regions)} регионов, суммарно {total_pages} страниц...")

    page_counter = 0
    for r_cfg in regions:
        city = r_cfg["city"]
        slug = r_cfg["slug"]
        pages = r_cfg["pages"]
        logger.info(f"==> Парсинг региона: {city} ({slug}) — {pages} страниц")

        for p in range(1, pages + 1):
            page_counter += 1
            raw_hotels = fetch_page_cached(client, slug, p, CACHE_DIR)
            if not raw_hotels:
                continue

            added = 0
            for h in raw_hotels:
                norm = normalize_hotel(h, r_cfg)
                if norm and norm["id"] not in all_hotels:
                    all_hotels[norm["id"]] = norm
                    added += 1

            logger.info(f"[{page_counter}/{total_pages}] {city} стр. {p}: +{added} отелей (всего уникальных: {len(all_hotels)})")

    hotels_list = list(all_hotels.values())
    logger.info(f"Парсинг завершен! Успешно собрано {len(hotels_list)} уникальных отелей.")

    os.makedirs(os.path.dirname(target_file), exist_ok=True)
    with open(target_file, "w", encoding="utf-8") as f:
        json.dump(hotels_list, f, ensure_ascii=False, indent=2)

    logger.info(f"Датасет сохранен в: {target_file}")
    return hotels_list

if __name__ == "__main__":
    import sys
    wave = sys.argv[1] if len(sys.argv) > 1 else "1"

    if wave == "1":
        logger.info("Запуск Волны 1 (Базовые регионы, цель ≥ 1200 отелей)...")
        hotels = run_parser(WAVE_1_REGIONS, OUTPUT_PATH)
        print(f"RESULT_WAVE_1_COUNT={len(hotels)}")
    elif wave == "2":
        logger.info("Запуск Волны 2 (Расширение +1000 отелей)...")
        # Объединяем регионы Волны 1 и Волны 2
        combined_regions = WAVE_1_REGIONS + WAVE_2_REGIONS
        hotels = run_parser(combined_regions, OUTPUT_PATH)
        print(f"RESULT_COMBINED_COUNT={len(hotels)}")
