import json
import os

from fastapi import APIRouter, HTTPException

from ..services.vector_store import get_hotel_by_id

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
            with open(sharded_path, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка чтения данных отеля: {e}")

    # Fallback на данные из каталога в памяти
    hotel = get_hotel_by_id(hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail=f"Отель '{hotel_id}' не найден")

    return hotel.model_dump()
