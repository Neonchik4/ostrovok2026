"""Studio API router: schema metadata, data browser, and backup."""
import os
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.database import get_db, is_db_configured
from ..db.repository import HotelRepository
from ..services.vector_store import get_hotels_dataset, get_hotel_by_id

router = APIRouter(prefix="/api/studio", tags=["studio"])


@router.get("/schema")
async def get_schema():
    """Возвращает метаданные схемы таблиц и связей для интерактивной ER-диаграммы."""
    return HotelRepository.get_schema_metadata()


@router.get("/hotels")
async def get_hotels(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    city: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    session: Optional[AsyncSession] = Depends(get_db),
):
    """Табличный инспектор отелей с пагинацией и поиском."""
    if session is not None and is_db_configured():
        hotels, total = await HotelRepository.get_hotels_page(session, offset, limit, city, search)
        return {
            "source": "postgresql",
            "total": total,
            "offset": offset,
            "limit": limit,
            "items": [
                {
                    "id": h.id,
                    "name": h.name,
                    "city": h.city,
                    "stars": h.stars,
                    "price_from": h.min_price_per_night_rub,
                    "rating": h.rating,
                    "address": h.address,
                }
                for h in hotels
            ],
        }

    # Фолбэк на in-memory датасет
    all_hotels = get_hotels_dataset()
    filtered = all_hotels
    if city:
        filtered = [h for h in filtered if city.lower() in h.city.lower()]
    if search:
        filtered = [h for h in filtered if search.lower() in h.name.lower()]

    items = filtered[offset : offset + limit]
    return {
        "source": "memory",
        "total": len(filtered),
        "offset": offset,
        "limit": limit,
        "items": [
            {
                "id": h.id,
                "name": h.name,
                "city": h.city,
                "stars": h.stars,
                "price_from": h.min_price_per_night_rub,
                "rating": h.rating,
                "address": h.address,
            }
            for h in items
        ],
    }


@router.get("/hotels/{hotel_id}")
async def get_hotel_details(
    hotel_id: str,
    session: Optional[AsyncSession] = Depends(get_db),
):
    """Детальная информация об отеле, комнатах и правилах."""
    if session is not None and is_db_configured():
        hotel = await HotelRepository.get_hotel_full(session, hotel_id)
        if hotel:
            return hotel

    h = get_hotel_by_id(hotel_id)
    if not h:
        raise HTTPException(status_code=404, detail="Отель не найден")
    return h.model_dump()


@router.post("/backup/create")
async def create_backup():
    """Создает снимок базы данных и возвращает имя файла."""
    os.makedirs("outputs/backups", exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_file = f"outputs/backups/snapshot_{ts}.json"
    hotels = [h.model_dump() for h in get_hotels_dataset()[:200]]
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump({"timestamp": ts, "hotels_sample": hotels}, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "file": backup_file, "timestamp": ts}
