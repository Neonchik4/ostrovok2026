"""
Seed script: populates Managed PostgreSQL with hotels dataset and 384-dim embeddings from chroma_db_v2.
"""
import asyncio
import json
import os
import sys

from sqlalchemy import text

import app.db.database as db
from app.config import settings
from app.db.models import (
    AmenityModel,
    HotelModel,
    PoiDistanceModel,
    PolicyModel,
    ReviewModel,
    RoomTypeModel,
)


async def seed():
    print("=== [1/4] Инициализация схемы БД ===")
    initialized = await db.init_db()
    if not initialized:
        print("Ошибка: БД не подключена или недоступна.")
        sys.exit(1)

    print("=== [2/4] Загрузка датасета hotels.json и ChromaDB векторов ===")
    json_path = os.path.join(settings.BASE_DIR, "outputs", "hotels.json")
    if not os.path.exists(json_path):
        json_path = os.path.join("outputs", "hotels.json")
    with open(json_path, encoding="utf-8") as f:
        hotels_data = json.load(f)
    print(f"Загружено отелей из JSON: {len(hotels_data)}")

    chroma_path = os.path.join(settings.BASE_DIR, "outputs", "chroma_db_v2")
    if not os.path.exists(chroma_path):
        chroma_path = os.path.join("outputs", "chroma_db_v2")
    
    embeddings_map = {}
    try:
        import chromadb
        client = chromadb.PersistentClient(path=chroma_path)
        col = client.get_collection("hotels")
        total_chroma = col.count()
        print(f"ChromaDB содержит {total_chroma} записей. Извлечение векторов...")
        batch_size = 500
        for offset in range(0, total_chroma, batch_size):
            res = col.get(
                limit=batch_size,
                offset=offset,
                include=["embeddings"],
            )
            for hid, emb in zip(res["ids"], res["embeddings"]):
                embeddings_map[hid] = emb
        print(f"Извлечено эмбеддингов: {len(embeddings_map)}")
    except Exception as e:
        print(f"Предупреждение при чтении ChromaDB: {e}")

    print("=== [3/4] Пакетная вставка в PostgreSQL ===")
    session_factory = db._session_factory
    if session_factory is None:
        print("Ошибка: session_factory не инициализирована")
        sys.exit(1)

    async with session_factory() as session:
        existing_count = (await session.execute(text("SELECT count(*) FROM hotels"))).scalar() or 0
        print(f"Текущее количество отелей в БД: {existing_count}")
        if existing_count >= len(hotels_data):
            print("База данных уже содержит все отели. Пропуск вставки.")
        else:
            if existing_count > 0:
                print("Очистка неполной таблицы...")
                await session.execute(text("TRUNCATE TABLE hotels CASCADE;"))
                await session.commit()

            print("Подготовка моделей для пакетной вставки...")
            chunk_size = 200
            for i in range(0, len(hotels_data), chunk_size):
                chunk = hotels_data[i : i + chunk_size]
                hotel_models = []
                for h in chunk:
                    hid = h.get("id")
                    emb = embeddings_map.get(hid)
                    coords = h.get("coordinates") or {}
                    lat = coords.get("lat")
                    lon = coords.get("lon")

                    hm = HotelModel(
                        id=hid,
                        name=h.get("name", ""),
                        city=h.get("city", ""),
                        stars=h.get("stars", 0),
                        area=h.get("area", ""),
                        area_type=h.get("area_type", ""),
                        address=h.get("address", ""),
                        min_price_per_night_rub=h.get("min_price_per_night_rub", 0),
                        rating=float(h.get("rating") or 0.0),
                        reviews_count=h.get("reviews_count", 0),
                        description=h.get("description", ""),
                        lat=lat,
                        lon=lon,
                        image_urls=h.get("image_urls") or [],
                        tags=h.get("tags") or [],
                        embedding=emb,
                    )

                    amenities_raw = h.get("amenities") or {}
                    hm.amenities = AmenityModel(
                        hotel_id=hid,
                        pet_friendly=bool(amenities_raw.get("pet_friendly")),
                        heated_pool=bool(amenities_raw.get("heated_pool")),
                        outdoor_pool=bool(amenities_raw.get("outdoor_pool")),
                        spa=bool(amenities_raw.get("spa")),
                        sauna=bool(amenities_raw.get("sauna")),
                        fast_wifi=bool(amenities_raw.get("fast_wifi", True)),
                        free_parking=bool(amenities_raw.get("free_parking")),
                        ski_storage=bool(amenities_raw.get("ski_storage")),
                        restaurant_on_site=bool(amenities_raw.get("restaurant_on_site")),
                        gym=bool(amenities_raw.get("gym")),
                    )

                    pol_raw = h.get("policies") or {}
                    canc_raw = pol_raw.get("cancellation") or {}
                    pets_raw = pol_raw.get("pets") or {}
                    hm.policies = PolicyModel(
                        hotel_id=hid,
                        check_in_time=str(pol_raw.get("check_in_time", "14:00")),
                        check_out_time=str(pol_raw.get("check_out_time", "12:00")),
                        min_stay_nights=pol_raw.get("min_stay_nights", 1),
                        free_cancellation_hours=canc_raw.get("free_cancellation_deadline_hours", 24),
                        pet_allowed=bool(pets_raw.get("allowed")),
                        pet_deposit_rub=pets_raw.get("deposit_rub", 0),
                        pet_daily_fee_rub=pets_raw.get("daily_fee_rub", 0),
                        pet_max_weight_kg=pets_raw.get("max_weight_kg", 0),
                    )

                    for r in h.get("room_types") or []:
                        cap = r.get("capacity") or {}
                        hm.room_types.append(
                            RoomTypeModel(
                                hotel_id=hid,
                                name=r.get("name", ""),
                                price_per_night_rub=r.get("price_per_night_rub", 0),
                                max_adults=cap.get("max_adults", 2),
                                max_children=cap.get("max_children", 0),
                                max_total_guests=cap.get("max_total_guests", 2),
                                has_balcony=bool(r.get("has_balcony")),
                                has_kitchen=bool(r.get("has_kitchen")),
                                breakfast_included=bool(r.get("breakfast_included")),
                                bed_setup=r.get("bed_setup"),
                                area_sqm=r.get("area_sqm"),
                            )
                        )

                    loc_det = h.get("location_details") or {}
                    if loc_det.get("distance_to_center_km") is not None:
                        hm.poi_distances.append(
                            PoiDistanceModel(
                                hotel_id=hid,
                                poi_name="Центр города",
                                category="center",
                                distance_m=int(loc_det["distance_to_center_km"] * 1000),
                            )
                        )
                    if loc_det.get("distance_to_beach_m") is not None:
                        hm.poi_distances.append(
                            PoiDistanceModel(
                                hotel_id=hid,
                                poi_name="Пляж",
                                category="beach",
                                distance_m=int(loc_det["distance_to_beach_m"]),
                            )
                        )
                    if loc_det.get("distance_to_ski_lift_m") is not None:
                        hm.poi_distances.append(
                            PoiDistanceModel(
                                hotel_id=hid,
                                poi_name="Подъемник",
                                category="ski_lift",
                                distance_m=int(loc_det["distance_to_ski_lift_m"]),
                            )
                        )

                    for rev in (h.get("top_reviews") or [])[:5]:
                        hm.reviews.append(
                            ReviewModel(
                                hotel_id=hid,
                                author=rev.get("author", "Гость"),
                                date=rev.get("date", ""),
                                rating=float(rev.get("rating") or 0.0),
                                plus=rev.get("plus", ""),
                                minus=rev.get("minus", ""),
                                room=rev.get("room", ""),
                            )
                        )

                    hotel_models.append(hm)

                session.add_all(hotel_models)
                await session.commit()
                print(f"  Вставлено {min(i + chunk_size, len(hotels_data))}/{len(hotels_data)} отелей...")

    print("=== [4/4] Создание HNSW индекса для ускорения векторного поиска ===")
    engine = db.get_engine()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_hotels_embedding_hnsw "
                "ON hotels USING hnsw (embedding vector_cosine_ops);"
            )
        )
    print("Индекс HNSW успешно создан/проверен.")
    print("=== Готово! Датасет и эмбеддинги полностью засижены в Managed PostgreSQL ===")


if __name__ == "__main__":
    asyncio.run(seed())
