"""Database repository for hotel queries, hybrid pgvector search and proposal audits."""
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from .models import (
    HotelModel,
    RoomTypeModel,
    AmenityModel,
    PolicyModel,
    PoiDistanceModel,
    ReviewModel,
    EnrichmentProposalModel,
    AuditHotelSnapshotModel,
)


class HotelRepository:
    @staticmethod
    async def get_hotels_page(
        session: AsyncSession,
        offset: int = 0,
        limit: int = 20,
        city: Optional[str] = None,
        search_query: Optional[str] = None,
    ) -> Tuple[List[HotelModel], int]:
        """Возвращает пагинированный список отелей и общее количество."""
        conditions = []
        if city:
            conditions.append(HotelModel.city.ilike(f"%{city}%"))
        if search_query:
            conditions.append(HotelModel.name.ilike(f"%{search_query}%"))

        stmt = select(HotelModel)
        count_stmt = select(func.count(HotelModel.id))

        if conditions:
            stmt = stmt.where(and_(*conditions))
            count_stmt = count_stmt.where(and_(*conditions))

        stmt = stmt.order_by(desc(HotelModel.rating)).offset(offset).limit(limit)

        res = await session.execute(stmt)
        total_res = await session.execute(count_stmt)

        return list(res.scalars().all()), total_res.scalar() or 0

    @staticmethod
    async def get_hotel_full(session: AsyncSession, hotel_id: str) -> Optional[HotelModel]:
        stmt = (
            select(HotelModel)
            .where(HotelModel.id == hotel_id)
            .options(
                selectinload(HotelModel.room_types),
                selectinload(HotelModel.amenities),
                selectinload(HotelModel.policies),
                selectinload(HotelModel.poi_distances),
                selectinload(HotelModel.reviews),
            )
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def search_hybrid(
        session: AsyncSession,
        query_vector: List[float],
        city: Optional[str] = None,
        max_price: Optional[int] = None,
        pet_friendly: bool = False,
        limit: int = 20,
    ) -> List[HotelModel]:
        """Гибридный векторный поиск через pgvector (HNSW <=> cosine distance)."""
        conditions = [HotelModel.embedding.isnot(None)]
        if city:
            conditions.append(HotelModel.city.ilike(f"%{city}%"))
        if max_price:
            conditions.append(HotelModel.min_price_per_night_rub <= max_price)
        if pet_friendly:
            conditions.append(HotelModel.amenities.has(pet_friendly=True))

        distance_expr = HotelModel.embedding.cosine_distance(query_vector)
        stmt = (
            select(HotelModel)
            .where(and_(*conditions))
            .order_by(distance_expr)
            .limit(limit)
        )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    def get_schema_metadata() -> Dict[str, Any]:
        """Интроспекция метаданных схемы для интерактивной ER-диаграммы фронтенда."""
        tables = [
            {
                "name": "hotels",
                "label": "Отели (Hotels)",
                "columns": [
                    {"name": "id", "type": "VARCHAR(64)", "pk": True, "fk": None},
                    {"name": "name", "type": "VARCHAR(255)", "pk": False, "fk": None},
                    {"name": "city", "type": "VARCHAR(128)", "pk": False, "fk": None},
                    {"name": "stars", "type": "INT", "pk": False, "fk": None},
                    {"name": "min_price_per_night_rub", "type": "INT", "pk": False, "fk": None},
                    {"name": "rating", "type": "FLOAT", "pk": False, "fk": None},
                    {"name": "embedding", "type": "VECTOR(768)", "pk": False, "fk": None},
                ],
            },
            {
                "name": "room_types",
                "label": "Номера (Room Types)",
                "columns": [
                    {"name": "id", "type": "INT", "pk": True, "fk": None},
                    {"name": "hotel_id", "type": "VARCHAR(64)", "pk": False, "fk": "hotels.id"},
                    {"name": "name", "type": "VARCHAR(255)", "pk": False, "fk": None},
                    {"name": "price_per_night_rub", "type": "INT", "pk": False, "fk": None},
                    {"name": "max_total_guests", "type": "INT", "pk": False, "fk": None},
                ],
            },
            {
                "name": "hotel_amenities",
                "label": "Удобства (Amenities)",
                "columns": [
                    {"name": "hotel_id", "type": "VARCHAR(64)", "pk": True, "fk": "hotels.id"},
                    {"name": "pet_friendly", "type": "BOOLEAN", "pk": False, "fk": None},
                    {"name": "heated_pool", "type": "BOOLEAN", "pk": False, "fk": None},
                    {"name": "spa", "type": "BOOLEAN", "pk": False, "fk": None},
                    {"name": "sauna", "type": "BOOLEAN", "pk": False, "fk": None},
                ],
            },
            {
                "name": "hotel_policies",
                "label": "Правила (Policies)",
                "columns": [
                    {"name": "hotel_id", "type": "VARCHAR(64)", "pk": True, "fk": "hotels.id"},
                    {"name": "check_in_time", "type": "VARCHAR(16)", "pk": False, "fk": None},
                    {"name": "pet_deposit_rub", "type": "INT", "pk": False, "fk": None},
                    {"name": "pet_daily_fee_rub", "type": "INT", "pk": False, "fk": None},
                ],
            },
            {
                "name": "poi_distances",
                "label": "Точки интереса (POI)",
                "columns": [
                    {"name": "id", "type": "INT", "pk": True, "fk": None},
                    {"name": "hotel_id", "type": "VARCHAR(64)", "pk": False, "fk": "hotels.id"},
                    {"name": "poi_name", "type": "VARCHAR(255)", "pk": False, "fk": None},
                    {"name": "distance_m", "type": "INT", "pk": False, "fk": None},
                ],
            },
            {
                "name": "hotel_reviews",
                "label": "Отзывы (Reviews)",
                "columns": [
                    {"name": "id", "type": "INT", "pk": True, "fk": None},
                    {"name": "hotel_id", "type": "VARCHAR(64)", "pk": False, "fk": "hotels.id"},
                    {"name": "author", "type": "VARCHAR(128)", "pk": False, "fk": None},
                    {"name": "rating", "type": "FLOAT", "pk": False, "fk": None},
                ],
            },
            {
                "name": "enrichment_proposals",
                "label": "Очередь обогащения AI",
                "columns": [
                    {"name": "id", "type": "VARCHAR(64)", "pk": True, "fk": None},
                    {"name": "hotel_id", "type": "VARCHAR(64)", "pk": False, "fk": "hotels.id"},
                    {"name": "status", "type": "VARCHAR(32)", "pk": False, "fk": None},
                    {"name": "diff_patch", "type": "JSON", "pk": False, "fk": None},
                ],
            },
            {
                "name": "audit_hotel_snapshots",
                "label": "Снимки отката (Rollback Audit)",
                "columns": [
                    {"name": "id", "type": "INT", "pk": True, "fk": None},
                    {"name": "proposal_id", "type": "VARCHAR(64)", "pk": False, "fk": "enrichment_proposals.id"},
                    {"name": "hotel_id", "type": "VARCHAR(64)", "pk": False, "fk": "hotels.id"},
                    {"name": "state_before", "type": "JSON", "pk": False, "fk": None},
                ],
            },
        ]

        relations = [
            {"from_table": "room_types", "from_column": "hotel_id", "to_table": "hotels", "to_column": "id", "label": "1:N"},
            {"from_table": "hotel_amenities", "from_column": "hotel_id", "to_table": "hotels", "to_column": "id", "label": "1:1"},
            {"from_table": "hotel_policies", "from_column": "hotel_id", "to_table": "hotels", "to_column": "id", "label": "1:1"},
            {"from_table": "poi_distances", "from_column": "hotel_id", "to_table": "hotels", "to_column": "id", "label": "1:N"},
            {"from_table": "hotel_reviews", "from_column": "hotel_id", "to_table": "hotels", "to_column": "id", "label": "1:N"},
            {"from_table": "enrichment_proposals", "from_column": "hotel_id", "to_table": "hotels", "to_column": "id", "label": "1:N"},
            {"from_table": "audit_hotel_snapshots", "from_column": "hotel_id", "to_table": "hotels", "to_column": "id", "label": "1:N"},
            {"from_table": "audit_hotel_snapshots", "from_column": "proposal_id", "to_table": "enrichment_proposals", "to_column": "id", "label": "1:1"},
        ]

        return {"tables": tables, "relations": relations}

    @staticmethod
    async def create_proposal(
        session: AsyncSession,
        proposal_id: str,
        hotel_id: Optional[str],
        diff_patch: Dict[str, Any],
        rationale: str,
        source_url: Optional[str] = None,
        target_type: str = "enrichment",
    ) -> EnrichmentProposalModel:
        proposal = EnrichmentProposalModel(
            id=proposal_id,
            hotel_id=hotel_id,
            status="pending",
            target_type=target_type,
            diff_patch=diff_patch,
            rationale=rationale,
            source_url=source_url,
            created_at=datetime.utcnow(),
        )
        session.add(proposal)
        await session.commit()
        await session.refresh(proposal)
        return proposal

    @staticmethod
    async def get_proposals(
        session: AsyncSession,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[EnrichmentProposalModel]:
        stmt = select(EnrichmentProposalModel).order_by(desc(EnrichmentProposalModel.created_at)).limit(limit)
        if status:
            stmt = stmt.where(EnrichmentProposalModel.status == status)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def approve_proposal(
        session: AsyncSession,
        proposal_id: str,
    ) -> Optional[EnrichmentProposalModel]:
        """Применяет предложение: фиксирует снимок до изменения, обновляет данные и статус."""
        stmt = select(EnrichmentProposalModel).where(EnrichmentProposalModel.id == proposal_id)
        res = await session.execute(stmt)
        prop = res.scalar_one_or_none()
        if not prop or prop.status != "pending":
            return None

        # Фиксируем снимок состояния отеля до обновления
        if prop.hotel_id:
            h_stmt = select(HotelModel).where(HotelModel.id == prop.hotel_id)
            h_res = await session.execute(h_stmt)
            hotel = h_res.scalar_one_or_none()
            if hotel:
                snapshot_data = {
                    "name": hotel.name,
                    "city": hotel.city,
                    "min_price_per_night_rub": hotel.min_price_per_night_rub,
                    "rating": hotel.rating,
                    "description": hotel.description,
                }
                snap = AuditHotelSnapshotModel(
                    proposal_id=prop.id,
                    hotel_id=hotel.id,
                    state_before=snapshot_data,
                    created_at=datetime.utcnow(),
                )
                session.add(snap)

                # Применяем поля из diff_patch
                patch = prop.diff_patch or {}
                for k, v in patch.items():
                    if hasattr(hotel, k) and k not in ("id", "embedding"):
                        setattr(hotel, k, v)

        prop.status = "approved"
        prop.reviewed_at = datetime.utcnow()
        await session.commit()
        await session.refresh(prop)
        return prop

    @staticmethod
    async def rollback_proposal(
        session: AsyncSession,
        proposal_id: str,
    ) -> bool:
        """Откатывает изменения отеля по сохраненному снимку."""
        snap_stmt = select(AuditHotelSnapshotModel).where(AuditHotelSnapshotModel.proposal_id == proposal_id)
        snap_res = await session.execute(snap_stmt)
        snap = snap_res.scalar_one_or_none()
        if not snap:
            return False

        h_stmt = select(HotelModel).where(HotelModel.id == snap.hotel_id)
        h_res = await session.execute(h_stmt)
        hotel = h_res.scalar_one_or_none()
        if not hotel:
            return False

        # Восстанавливаем старое состояние
        for k, v in (snap.state_before or {}).items():
            if hasattr(hotel, k):
                setattr(hotel, k, v)

        p_stmt = select(EnrichmentProposalModel).where(EnrichmentProposalModel.id == proposal_id)
        p_res = await session.execute(p_stmt)
        prop = p_res.scalar_one_or_none()
        if prop:
            prop.status = "rolled_back"
            prop.reviewed_at = datetime.utcnow()

        await session.commit()
        return True
