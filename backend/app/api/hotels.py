import json
import os
from typing import Any

from fastapi import APIRouter, HTTPException

from ..services.checkout_service import build_ostrovok_checkout_url
from ..services.vector_store import get_hotel_by_id

router = APIRouter(prefix="/hotels", tags=["Hotels"])

ROOT_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
HOTELS_DIR = os.path.join(ROOT_DIR, "outputs", "hotels")


def _enrich_hotel_reviews(data: dict[str, Any], hotel_id: str) -> None:
    raw_reviews = data.get("top_reviews") or data.get("reviews") or []
    reviews_list: list[dict[str, Any]] = []
    for idx, r in enumerate(raw_reviews):
        item = dict(r) if isinstance(r, dict) else r.model_dump()
        if not item.get("id"):
            item["id"] = f"{hotel_id}_rev_{idx + 1}"
        reviews_list.append(item)
    data["reviews"] = reviews_list
    data["top_reviews"] = reviews_list


@router.get("/{hotel_id}")
async def get_hotel_details(hotel_id: str):
    """
    Возвращает полную информацию об отеле с массивом реальных отзывов
    из локального дискового кэша outputs/hotels/{hotel_id}.json.
    """
    sharded_path = os.path.join(HOTELS_DIR, f"{hotel_id}.json")
    if os.path.exists(sharded_path):
        try:
            with open(sharded_path, encoding="utf-8") as f:
                data = json.load(f)
                if not data.get("checkout_url"):
                    data["checkout_url"] = build_ostrovok_checkout_url(data)
                _enrich_hotel_reviews(data, hotel_id)
                return data
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка чтения данных отеля: {e}")

    # Fallback на данные из каталога в памяти
    hotel = get_hotel_by_id(hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail=f"Отель '{hotel_id}' не найден")

    dump = hotel.model_dump()
    if not dump.get("checkout_url"):
        dump["checkout_url"] = build_ostrovok_checkout_url(hotel)
    _enrich_hotel_reviews(dump, hotel_id)
    return dump
