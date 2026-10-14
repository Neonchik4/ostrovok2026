"""Studio API router: schema metadata, data browser, enrichment and snapshot rollback."""
import os
import json
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import verify_team_token
from ..db.database import get_db, is_db_configured
from ..db.repository import HotelRepository
from ..services.vector_store import get_hotels_dataset, get_hotel_by_id
from ..services.enrichment_agent import run_enrichment_task

router = APIRouter(prefix="/api/studio", tags=["studio"])

# In-memory fallback хранилище предложений для локального режима
_mem_proposals: Dict[str, Dict[str, Any]] = {}
_mem_snapshots: Dict[str, Dict[str, Any]] = {}


@router.get("/auth-status")
async def get_auth_status():
    """Проверяет режим работы и возвращает токен для локальной разработки (dev)."""
    from ..config import settings
    is_dev = getattr(settings, "APP_ENV", "development").lower() != "production"
    auto_token = getattr(settings, "STUDIO_TEAM_TOKEN", "") if is_dev else None
    return {
        "is_dev": is_dev,
        "auto_token": auto_token or ("dev_local_token" if is_dev else None),
        "requires_auth": not is_dev,
    }


@router.get("/schema")
async def get_schema(token: str = Depends(verify_team_token)):
    """Возвращает метаданные схемы таблиц и связей для интерактивной ER-диаграммы."""
    return HotelRepository.get_schema_metadata()


@router.get("/hotels")
async def get_hotels(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    city: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    session: Optional[AsyncSession] = Depends(get_db),
    token: str = Depends(verify_team_token),
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
    token: str = Depends(verify_team_token),
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


@router.get("/proposals")
async def list_proposals(
    status_filter: Optional[str] = Query(None, alias="status"),
    session: Optional[AsyncSession] = Depends(get_db),
    token: str = Depends(verify_team_token),
):
    """Список заявок на обогащение."""
    if session is not None and is_db_configured():
        return await HotelRepository.get_proposals(session, status_filter)

    items = list(_mem_proposals.values())
    if status_filter:
        items = [p for p in items if p.get("status") == status_filter]
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items


@router.post("/proposals/{proposal_id}/approve")
async def approve_proposal(
    proposal_id: str,
    session: Optional[AsyncSession] = Depends(get_db),
    token: str = Depends(verify_team_token),
):
    """Одобрение предложения: фиксация снапшота и применение изменений."""
    if session is not None and is_db_configured():
        prop = await HotelRepository.approve_proposal(session, proposal_id)
        if not prop:
            raise HTTPException(status_code=404, detail="Заявка не найдена или уже обработана")
        return {"status": "ok", "proposal_id": proposal_id}

    prop = _mem_proposals.get(proposal_id)
    if not prop or prop.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Заявка не найдена или уже обработана")

    # Сохраняем снимок для отката
    h_id = prop.get("hotel_id")
    hotel = get_hotel_by_id(h_id) if h_id else None
    if hotel:
        _mem_snapshots[proposal_id] = {
            "name": hotel.name,
            "city": hotel.city,
            "min_price_per_night_rub": hotel.min_price_per_night_rub,
            "rating": hotel.rating,
        }
        for k, v in (prop.get("diff_patch") or {}).items():
            if hasattr(hotel, k) and k not in ("id", "embedding"):
                setattr(hotel, k, v)

    prop["status"] = "approved"
    prop["reviewed_at"] = datetime.utcnow().isoformat()
    return {"status": "ok", "proposal_id": proposal_id}


@router.post("/proposals/{proposal_id}/reject")
async def reject_proposal(
    proposal_id: str,
    session: Optional[AsyncSession] = Depends(get_db),
    token: str = Depends(verify_team_token),
):
    """Отклонение предложения."""
    if session is not None and is_db_configured():
        # Репозиторий
        pass

    prop = _mem_proposals.get(proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    prop["status"] = "rejected"
    prop["reviewed_at"] = datetime.utcnow().isoformat()
    return {"status": "ok", "proposal_id": proposal_id}


@router.post("/proposals/{proposal_id}/rollback")
async def rollback_proposal(
    proposal_id: str,
    session: Optional[AsyncSession] = Depends(get_db),
    token: str = Depends(verify_team_token),
):
    """Откат изменений к сохраненному снимку."""
    if session is not None and is_db_configured():
        success = await HotelRepository.rollback_proposal(session, proposal_id)
        if not success:
            raise HTTPException(status_code=400, detail="Не удалось выполнить откат")
        return {"status": "ok", "proposal_id": proposal_id}

    snap = _mem_snapshots.get(proposal_id)
    prop = _mem_proposals.get(proposal_id)
    if not snap or not prop:
        raise HTTPException(status_code=404, detail="Снимок для отката не найден")

    h_id = prop.get("hotel_id")
    hotel = get_hotel_by_id(h_id) if h_id else None
    if hotel:
        for k, v in snap.items():
            if hasattr(hotel, k):
                setattr(hotel, k, v)

    prop["status"] = "rolled_back"
    return {"status": "ok", "proposal_id": proposal_id}


@router.post("/enrich/stream")
async def start_enrichment_stream(
    payload: Dict[str, Any] = Body(...),
    token: str = Depends(verify_team_token),
):
    """SSE стрим работы автономного агента обогащения Gemini."""
    prompt = payload.get("prompt", "Обогатить удобства и правила отелей")
    city = payload.get("city", "Сочи")
    hotel_id = payload.get("hotel_id")

    async def event_generator():
        async for event in run_enrichment_task(prompt, city, hotel_id):
            if event.get("step") == "proposal_ready":
                p_id = event["proposal_id"]
                _mem_proposals[p_id] = {
                    "id": p_id,
                    "hotel_id": event.get("hotel_id"),
                    "hotel_name": event.get("hotel_name"),
                    "status": "pending",
                    "diff_patch": event.get("diff_patch", {}),
                    "rationale": event.get("rationale", ""),
                    "source_url": event.get("source_url", ""),
                    "created_at": datetime.utcnow().isoformat(),
                }
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.05)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/backup/create")
async def create_backup(token: str = Depends(verify_team_token)):
    """Создает снимок базы данных и возвращает имя файла."""
    os.makedirs("outputs/backups", exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_file = f"outputs/backups/snapshot_{ts}.json"
    hotels = [h.model_dump() for h in get_hotels_dataset()[:200]]
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump({"timestamp": ts, "hotels_sample": hotels}, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "file": backup_file, "timestamp": ts}
