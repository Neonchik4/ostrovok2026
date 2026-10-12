import os
import json
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/hotels", tags=["Hotels"])

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
HOTELS_DIR = os.path.join(ROOT_DIR, "outputs", "hotels")


@router.get("/{hotel_id}")
async def get_hotel_details(hotel_id: str):
    """
    Возвращает полную информацию об отеле с массивом реальных отзывов
    из локального дискового кэша outputs/hotels/{hotel_id}.json.
    """
    sharded_path = os.path.join(HOTELS_DIR, f"{hotel_id}.json")
    if os.path.exists(sharded_path):
        try:
            with open(sharded_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка чтения данных отеля: {e}")

    raise HTTPException(status_code=404, detail=f"Отель '{hotel_id}' не найден")
