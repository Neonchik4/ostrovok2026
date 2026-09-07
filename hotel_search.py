"""
hotel_search.py — v2 (Модуль гибридного поиска отелей)
"""
import json
import os
import asyncio
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
import chromadb
from sentence_transformers import SentenceTransformer

class HotelFilterSchema(BaseModel):
    city: Optional[str] = Field(None, description="Город (напр. 'Сочи')")
    area_type: Optional[str] = Field(None, description="mountains | sea | center")
    stars: Optional[int] = Field(None, description="Мин. количество звезд (1-5)")
    max_price_per_night_rub: Optional[int] = Field(None, description="Макс. цена за ночь, ₽")
    min_rating: Optional[float] = Field(None, description="Мин. рейтинг (1.0–5.0)")
    pet_friendly: Optional[bool] = Field(None, description="Разрешены питомцы")
    heated_pool: Optional[bool] = Field(None, description="Подогреваемый бассейн")
    spa: Optional[bool] = Field(None, description="Спа-центр")
    breakfast_included: Optional[bool] = Field(None, description="Завтрак включён")
    free_cancellation: Optional[bool] = Field(None, description="Бесплатная отмена")
    max_distance_to_beach_m: Optional[int] = Field(None, description="Дистанция до моря, м")
    max_distance_to_ski_lift_m: Optional[int] = Field(None, description="Дистанция до подъемника, м")
    guests_count: Optional[int] = Field(None, description="Количество гостей")
    top_k: int = Field(5, description="Количество результатов")

class HotelDetailResult(BaseModel):
    id: str
    name: str
    city: str
    stars: int
    area: str
    area_type: str
    address: str
    min_price_per_night_rub: int
    rating: float
    reviews_count: int
    location_details: Dict[str, Any]
    amenities: Dict[str, Any]
    room_types: List[Dict[str, Any]]
    policies: Dict[str, Any]
    tags: List[str]
    reviews_summary: Dict[str, Any]
    description: str
    image_urls: List[str]
    score: float
    suitable_rooms: List[Dict[str, Any]] = Field(default_factory=list)

_model: Any = None
_collection: Any = None
_hotels_index: Dict[str, Dict[str, Any]] = {}

def _resolve_db_path() -> str:
    for p in ["./outputs/chroma_db_v2", "./outputs/chroma_db", "../outputs/chroma_db_v2"]:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("ChromaDB не найдена.")

def _resolve_dataset_path() -> str:
    for p in ["./outputs/hotels_dataset.json", "./hotels_dataset.json", "../outputs/hotels_dataset.json"]:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("hotels_dataset.json не найден.")

def _init() -> None:
    global _model, _collection, _hotels_index
    if _model is None:
        _model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    if _collection is None:
        client = chromadb.PersistentClient(path=_resolve_db_path())
        _collection = client.get_collection("hotels")
    if not _hotels_index:
        with open(_resolve_dataset_path(), encoding="utf-8") as f:
            _hotels_index = {h["id"]: h for h in json.load(f)}

async def search_hotels(filters: HotelFilterSchema, semantic_query: str) -> List[HotelDetailResult]:
    _init()
    if _model is None or _collection is None:
        return []

    clauses = []
    if filters.city:                          clauses.append({"city": {"$eq": filters.city}})
    if filters.area_type:                     clauses.append({"area_type": {"$eq": filters.area_type}})
    if filters.stars is not None:             clauses.append({"stars": {"$gte": filters.stars}})
    if filters.max_price_per_night_rub:       clauses.append({"min_price_rub": {"$lte": filters.max_price_per_night_rub}})
    if filters.min_rating:                    clauses.append({"rating": {"$gte": filters.min_rating}})
    if filters.pet_friendly is not None:      clauses.append({"pet_friendly": {"$eq": str(filters.pet_friendly)}})
    if filters.heated_pool is not None:       clauses.append({"heated_pool": {"$eq": str(filters.heated_pool)}})
    if filters.spa is not None:               clauses.append({"spa": {"$eq": str(filters.spa)}})
    if filters.breakfast_included is not None:clauses.append({"breakfast_included": {"$eq": str(filters.breakfast_included)}})
    if filters.free_cancellation is not None: clauses.append({"free_cancellation": {"$eq": str(filters.free_cancellation)}})
    if filters.max_distance_to_beach_m:       clauses.append({"distance_to_beach_m": {"$lte": filters.max_distance_to_beach_m}})
    if filters.max_distance_to_ski_lift_m:    clauses.append({"distance_to_ski_lift_m": {"$lte": filters.max_distance_to_ski_lift_m}})

    where = {"$and": clauses} if len(clauses) > 1 else (clauses[0] if clauses else None)
    query_emb = await asyncio.to_thread(_model.encode, [semantic_query])
    kwargs: Dict[str, Any] = {
        "query_embeddings": query_emb.tolist(),
        "n_results": min(filters.top_k, _collection.count()),
        "include": ["metadatas", "documents", "distances"]
    }
    if where:
        kwargs["where"] = where
    res = _collection.query(**kwargs)

    out = []
    for i, (meta, doc, dist) in enumerate(zip(res["metadatas"][0], res["documents"][0], res["distances"][0])):
        hotel_id = res["ids"][0][i]
        full = _hotels_index.get(hotel_id)
        if not full:
            continue
        suitable = [r for r in full.get("room_types", [])
                    if r["capacity"]["max_total_guests"] >= (filters.guests_count or 1)]
        out.append(HotelDetailResult(
            id=hotel_id, name=full["name"], city=full["city"], stars=full["stars"],
            area=full["area"], area_type=full["area_type"], address=full["address"],
            min_price_per_night_rub=full["min_price_per_night_rub"],
            rating=full["rating"], reviews_count=full["reviews_count"],
            location_details=full["location_details"], amenities=full["amenities"],
            room_types=full["room_types"], policies=full["policies"], tags=full["tags"],
            reviews_summary=full["reviews_summary"], description=doc,
            image_urls=full.get("image_urls", []),
            score=round(1 - dist, 4), suitable_rooms=suitable,
        ))
    return out
