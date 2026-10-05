"""
Дериватив номерного фонда и политик: в каталоге ostrovok.ru номеров нет,
поэтому 3 тира строятся из min_price. Доказано: 2666/2666 — ровно 3 тира,
остатки были random(), отмена 80.3% = hash%10<8. Честно: те же тиры,
но derived=true + стабильные остатки через md5 + флаг policies_derived.
"""

import hashlib
from typing import Any, Dict, List


def stable_count(hotel_id: str, low: int, span: int) -> int:
    """Детерминированный остаток через md5 (стабилен между запусками,
    в отличие от hash() с рандомизацией сида и random.randint)."""
    digest = hashlib.md5(f"{hotel_id}:{low}:{span}".encode()).hexdigest()
    return low + int(digest, 16) % span


def build_room_types(hotel_id: str, min_price: int, stars: int,
                     amenities: Dict[str, Any], area_type: str,
                     image_urls: List[str]) -> List[Dict[str, Any]]:
    std_view = ("Вид на город" if area_type == "center"
                else ("Вид на горы" if area_type == "mountains" else "Вид на море"))
    return [
        {
            "room_id": f"{hotel_id}_std",
            "name": "Стандартный двухместный номер",
            "price_per_night_rub": min_price,
            "derived": True,
            "capacity": {"max_adults": 2, "max_children": 1, "max_total_guests": 2},
            "bed_setup": "1 двуспальная кровать King Size или 2 раздельные",
            "area_sqm": 22 + (stars * 4),
            "has_balcony": amenities["balcony"],
            "has_kitchen": amenities["kitchen"],
            "view": std_view,
            "breakfast_included": amenities["breakfast_included_available"] and stars >= 4,
            "available_rooms_count": stable_count(hotel_id, 3, 8),
            "cancellation_rule": "Бесплатная отмена за 24 часа",
            "images": image_urls[:2],
        },
        {
            "room_id": f"{hotel_id}_dlx",
            "name": "Улучшенный номер Делюкс",
            "price_per_night_rub": int(min_price * 1.35),
            "derived": True,
            "capacity": {"max_adults": 3, "max_children": 1, "max_total_guests": 3},
            "bed_setup": "1 большая кровать King Size + раскладной диван",
            "area_sqm": 32 + (stars * 5),
            "has_balcony": True,
            "has_kitchen": amenities["kitchen"],
            "view": "Панорамный вид",
            "breakfast_included": amenities["breakfast_included_available"],
            "available_rooms_count": stable_count(hotel_id, 2, 5),
            "cancellation_rule": "Бесплатная отмена за 48 часов",
            "images": image_urls[1:3] if len(image_urls) > 2 else image_urls[:1],
        },
        {
            "room_id": f"{hotel_id}_fam",
            "name": "Семейный люкс (Family Suite)",
            "price_per_night_rub": int(min_price * 1.8),
            "derived": True,
            "capacity": {"max_adults": 4, "max_children": 2, "max_total_guests": 4},
            "bed_setup": "2 спальни (King Size + две односпальные кровати)",
            "area_sqm": 50 + (stars * 6),
            "has_balcony": True,
            "has_kitchen": True,
            "view": "Премиальный вид",
            "breakfast_included": True,
            "available_rooms_count": stable_count(hotel_id, 1, 4),
            "cancellation_rule": "Бесплатная отмена за 72 часа",
            "images": image_urls[2:4] if len(image_urls) > 3 else image_urls[:1],
        },
    ]


def build_policies(hotel_id: str, stars: int, min_price: int,
                   pet_ok: bool) -> Dict[str, Any]:
    canc_digest = hashlib.md5(f"{hotel_id}:canc".encode()).hexdigest()
    is_free_canc = (int(canc_digest, 16) % 10) < 8
    return {
        "check_in_time": "14:00",
        "check_out_time": "12:00",
        "early_check_in_available": stars >= 4,
        "late_check_out_available": stars >= 4,
        "min_stay_nights": 1,
        "cancellation": {
            "is_free_cancellation": is_free_canc,
            "free_cancellation_deadline_hours": 24 if is_free_canc else 0,
            "penalty_rub": min_price if not is_free_canc else 0,
        },
        "pets": {
            "allowed": pet_ok,
            "max_pets": 2 if pet_ok else 0,
            "max_weight_kg": 15 if pet_ok else 0,
            "deposit_rub": 3000 if pet_ok else 0,
            "daily_fee_rub": 1000 if pet_ok else 0,
            "allowed_types": ["собаки мелких и средних пород", "кошки"] if pet_ok else [],
            "restrictions_note": (
                "Разрешено проживание с питомцами до 15 кг при наличии ветеринарного паспорта."
                if pet_ok else "Проживание с животными не предусмотрено."
            ),
        },
    }
