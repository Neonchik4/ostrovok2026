import os
import sys

_repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_repo_root, "scripts"))

from build_hotels_json import merge_hotel, strip_slop

from app.schemas.hotel_models import HotelFullSchema


def _base_hotel():
    return {
        "id": "t1",
        "name": "Тест Отель",
        "city": "Сочи",
        "stars": 4,
        "area": "Центр",
        "area_type": "sea",
        "address": "Сочи, Россия",
        "min_price_per_night_rub": 8000,
        "rating": 9.1,
        "reviews_count": 120,
        "location_details": {},
        "amenities": {"pet_friendly": True},
        "room_types": [],
        "policies": {},
        "tags": [],
        "reviews_summary": {
            "score_cleanliness": 4.6,
            "score_location": 4.7,
            "score_service": 4.5,
            "score_value_for_money": 4.4,
            "score_wifi": 4.8,
            # Доказанная синтетика: константа для всех 2666 отелей
            "positive_highlights": ["Чистота в номерах", "Вежливый персонал", "Удобное расположение"],
            "negative_highlights": [],
            # Доказанная синтетика: шаблон f"Отличный отель в {city}..." (19 уникальных на 2666)
            "review_snippets": ["Отличный отель в Сочи, номер соответствовал фотографиям. Обязательно вернемся снова!"],
        },
        "description": "Тест Отель — 4-звездочный отель в г. Сочи.",
        "image_urls": [
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
        ],
        "coordinates": {"lat": 43.58, "lon": 39.73},
    }


def _shard():
    long_plus = "Очень тихо, окна во двор, спали отлично все три ночи, персонал вежливый и отзывчивый."
    return {
        "reviews": [
            {"author": "Анна", "date": "2026-01-05", "rating": 9,
             "plus": long_plus, "minus": "", "room": "Стандарт", "traveller_type": "couple"},
            {"author": "Б", "date": "2026-01-06", "rating": 5,
             "plus": "ок", "minus": "шум", "room": "", "traveller_type": "other"},
        ],
        "reviews_summary": {
            "score_cleanliness": 4.4,
            "score_location": 4.3,
            "score_service": 4.4,
            "score_value_for_money": 4.7,
            "score_wifi": 4.8,
            "positive_highlights": [long_plus],
            "negative_highlights": ["Шумно со стороны дороги по ночам, слышно музыку из бара рядом с отелем."],
            "valid_reviews_count": 1,
            "traveller_distribution": {"couple": 1.0},
        },
        "total_ostrovok_reviews": 57,
    }


def test_merge_without_shard_marks_no_reviews():
    merged = merge_hotel(_base_hotel(), None)
    assert merged["reviews_summary"]["positive_highlights"] == []
    assert merged["reviews_summary"]["negative_highlights"] == []
    assert merged["reviews_summary"]["valid_reviews_count"] == 0
    assert merged["top_reviews"] == []
    assert merged["data_quality"]["has_real_reviews"] is False


def test_merge_with_shard_uses_real_reviews():
    merged = merge_hotel(_base_hotel(), _shard())
    assert merged["reviews_summary"]["positive_highlights"] != []
    assert "Очень тихо" in merged["reviews_summary"]["positive_highlights"][0]
    assert merged["reviews_summary"]["valid_reviews_count"] == 1
    assert merged["data_quality"]["has_real_reviews"] is True
    assert merged["total_ostrovok_reviews"] == 57
    # Короткий отзыв (<50 символов) отфильтрован из топа
    assert len(merged["top_reviews"]) == 1
    assert merged["top_reviews"][0]["author"] == "Анна"


def test_strip_slop_removes_snippets_and_unsplash():
    stripped = strip_slop(_base_hotel())
    assert "review_snippets" not in stripped.get("reviews_summary", {})
    assert stripped.get("image_urls") == []
    assert "reviews" not in stripped


def test_merged_hotel_validates_schema():
    merged = merge_hotel(strip_slop(_base_hotel()), _shard())
    obj = HotelFullSchema.model_validate(merged)
    assert obj.id == "t1"
    assert obj.data_quality.has_real_reviews is True
