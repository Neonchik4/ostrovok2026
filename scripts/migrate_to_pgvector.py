"""Migration script: imports 2666 hotels into normalized PostgreSQL tables with pgvector(768)."""
import os
import sys
import json
import asyncio
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "backend"))

from backend.app.config import settings
from backend.app.db.database import get_engine, init_db
from backend.app.db.models import (
    Base,
    HotelModel,
    RoomTypeModel,
    AmenityModel,
    PolicyModel,
    PoiDistanceModel,
    ReviewModel,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def migrate():
    db_url = settings.DATABASE_URL
    if not db_url:
        print("[Error] DATABASE_URL не установлен в .env или Doppler.")
        return

    print(f"[Migration] Подключение к PostgreSQL: {db_url.split('@')[-1]}...")
    success = await init_db()
    if not success:
        print("[Error] Не удалось подключиться к базе данных.")
        return

    engine = get_engine()
    dataset_path = BASE_DIR / "outputs" / "hotels.json"
    vectors_path = BASE_DIR / "outputs" / "mpnet_vectors_768.json"

    with open(dataset_path, "r", encoding="utf-8") as f:
        hotels = json.load(f)

    vectors = {}
    if vectors_path.exists():
        with open(vectors_path, "r", encoding="utf-8") as f:
            vectors = json.load(f)
        print(f"[Vectors] Загружено {len(vectors)} кэшированных векторов 768d.")

    print(f"[Import] Загрузка {len(hotels)} отелей в нормализованную схему...")
    async with AsyncSession(engine) as session:
        # Пакетная вставка
        batch_size = 200
        for i in range(0, len(hotels), batch_size):
            batch = hotels[i : i + batch_size]
            for h in batch:
                h_id = h["id"]
                emb = vectors.get(h_id)

                loc = h.get("location_details") or {}
                coords = h.get("coordinates") or {}

                hotel_model = HotelModel(
                    id=h_id,
                    name=h.get("name", ""),
                    city=h.get("city", ""),
                    stars=h.get("stars", 0),
                    area=h.get("area", ""),
                    area_type=h.get("area_type", ""),
                    address=h.get("address", ""),
                    min_price_per_night_rub=h.get("min_price_per_night_rub", 0),
                    rating=h.get("rating", 0.0),
                    reviews_count=h.get("reviews_count", 0),
                    description=h.get("description"),
                    lat=coords.get("lat"),
                    lon=coords.get("lon"),
                    image_urls=h.get("image_urls", []),
                    tags=h.get("tags", []),
                    embedding=emb,
                )
                session.add(hotel_model)

                # Amenities
                am = h.get("amenities") or {}
                session.add(
                    AmenityModel(
                        hotel_id=h_id,
                        pet_friendly=am.get("pet_friendly", False),
                        heated_pool=am.get("heated_pool", False),
                        outdoor_pool=am.get("outdoor_pool", False),
                        spa=am.get("spa", False),
                        sauna=am.get("sauna", False),
                        fast_wifi=am.get("fast_wifi", True),
                        free_parking=am.get("free_parking", False),
                        ski_storage=am.get("ski_storage", False),
                        restaurant_on_site=am.get("restaurant_on_site", False),
                        gym=am.get("gym", False),
                    )
                )

                # Policies
                pol = h.get("policies") or {}
                pets = pol.get("pets") or {}
                canc = pol.get("cancellation") or {}
                session.add(
                    PolicyModel(
                        hotel_id=h_id,
                        check_in_time=pol.get("check_in_time", "14:00"),
                        check_out_time=pol.get("check_out_time", "12:00"),
                        min_stay_nights=pol.get("min_stay_nights", 1),
                        free_cancellation_hours=canc.get("free_cancellation_deadline_hours", 24),
                        pet_allowed=pets.get("allowed", False),
                        pet_deposit_rub=pets.get("deposit_rub", 0),
                        pet_daily_fee_rub=pets.get("daily_fee_rub", 0),
                        pet_max_weight_kg=pets.get("max_weight_kg", 0),
                    )
                )

                # Room types
                for room in h.get("room_types", []):
                    session.add(
                        RoomTypeModel(
                            hotel_id=h_id,
                            name=room.get("name", "Стандарт"),
                            price_per_night_rub=room.get("price_per_night_rub", 0),
                            has_balcony=room.get("has_balcony", False),
                            has_kitchen=room.get("has_kitchen", False),
                            breakfast_included=room.get("breakfast_included", False),
                            bed_setup=room.get("bed_setup"),
                            area_sqm=room.get("area_sqm"),
                        )
                    )

            await session.commit()
            print(f"  Вставлено {min(i + batch_size, len(hotels))} / {len(hotels)} отелей...")

        # Создаем HNSW индекс
        print("[Index] Создание HNSW индекса на векторе...")
        try:
            await session.execute(
                text("CREATE INDEX IF NOT EXISTS hotels_embedding_hnsw_idx ON hotels USING hnsw (embedding vector_cosine_ops);")
            )
            await session.commit()
            print("[Success] HNSW индекс успешно создан!")
        except Exception as e:
            print(f"[Warning] Ошибка создания HNSW индекса: {e}")

    print("[Done] Миграция успешно завершена!")


if __name__ == "__main__":
    asyncio.run(migrate())
