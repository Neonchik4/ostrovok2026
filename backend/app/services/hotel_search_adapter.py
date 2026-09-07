import json
import os
import asyncio
from typing import List, Dict, Optional, TYPE_CHECKING
from ..config import settings
from ..schemas.chat import ExtractedSlots, HotelCardWidget
from ..schemas.hotel_models import HotelFullSchema, RoomType
from .receipt_calc import calculate_receipt

if TYPE_CHECKING:
    from chromadb.api.models.Collection import Collection
    from sentence_transformers import SentenceTransformer

_hotels_dataset: List[HotelFullSchema] = []
_hotels_by_id: Dict[str, HotelFullSchema] = {}
_chroma_collection: Optional["Collection"] = None
_embedding_model: Optional["SentenceTransformer"] = None

def init_dataset() -> None:
    global _hotels_dataset, _hotels_by_id
    if not _hotels_dataset:
        candidates = [
            settings.DATASET_PATH,
            "./outputs/hotels_dataset.json",
            "../outputs/hotels_dataset.json",
            "outputs/hotels_dataset.json"
        ]
        for p in candidates:
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    _hotels_dataset = [HotelFullSchema.model_validate(h) for h in raw_data]
                    _hotels_by_id = {h.id: h for h in _hotels_dataset}
                print(f"[Dataset] Загружено {len(_hotels_dataset)} отелей из {p}")
                break

def warmup_models() -> None:
    """Прогрев ChromaDB и эмбеддера в FastAPI Lifespan."""
    global _chroma_collection, _embedding_model
    init_dataset()
    
    # Попытка инициализации SentenceTransformer
    try:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
        print("[Embedding] SentenceTransformer инициализирован успешно.")
    except Exception as e:
        print(f"[Embedding Warning] Не удалось загрузить SentenceTransformer: {e}. Будет использован in-memory ранжировщик.")
        _embedding_model = None

    # Попытка подключения к ChromaDB
    try:
        import chromadb
        candidates = [
            settings.CHROMA_DB_PATH,
            "./outputs/chroma_db_v2",
            "../outputs/chroma_db_v2",
            "./outputs/chroma_db",
            "outputs/chroma_db_v2"
        ]
        db_path = None
        for p in candidates:
            if os.path.exists(p):
                db_path = p
                break
        if db_path:
            client = chromadb.PersistentClient(path=db_path)
            _chroma_collection = client.get_collection("hotels")
            print(f"[ChromaDB] Подключено к {db_path} ({_chroma_collection.count()} документов)")
    except Exception as e:
        print(f"[ChromaDB Warning] Не удалось подключиться к ChromaDB: {e}. Будет использован in-memory поиск.")
        _chroma_collection = None

async def search_hotels_unified(slots: ExtractedSlots) -> List[HotelCardWidget]:
    """
    Гибридный отказоустойчивый поиск:
    1. Если доступна ChromaDB + SentenceTransformer -> Векторный + метаданные
    2. Иначе -> Быстрый детерминированный in-memory поиск по 200 отелям с расчетом match_score
    """
    init_dataset()
    if not _hotels_dataset:
        return []

    # 1. Попытка через ChromaDB
    if _chroma_collection is not None and _embedding_model is not None:
        try:
            return await _search_chroma(slots)
        except Exception as e:
            print(f"[Search Fallback] Ошибка ChromaDB ({e}), переключение на in-memory...")

    # 2. In-Memory фильтрация и скоринг
    return _search_in_memory(slots)

async def _search_chroma(slots: ExtractedSlots) -> List[HotelCardWidget]:
    if _chroma_collection is None or _embedding_model is None:
        return []

    clauses: List[Dict[str, Dict[str, str | int | float]]] = []
    if slots.city:
        clauses.append({"city": {"$eq": slots.city}})
    if slots.area_type:
        clauses.append({"area_type": {"$eq": slots.area_type}})
    if slots.stars:
        clauses.append({"stars": {"$gte": slots.stars}})
    if slots.max_price_per_night_rub:
        clauses.append({"min_price_rub": {"$lte": slots.max_price_per_night_rub}})
    if slots.min_rating:
        clauses.append({"rating": {"$gte": slots.min_rating}})
    if slots.pet_friendly is not None:
        clauses.append({"pet_friendly": {"$eq": str(slots.pet_friendly)}})
    if slots.heated_pool is not None:
        clauses.append({"heated_pool": {"$eq": str(slots.heated_pool)}})
    if slots.spa is not None:
        clauses.append({"spa": {"$eq": str(slots.spa)}})
    if slots.breakfast_included is not None:
        clauses.append({"breakfast_included": {"$eq": str(slots.breakfast_included)}})
    if slots.free_cancellation is not None:
        clauses.append({"free_cancellation": {"$eq": str(slots.free_cancellation)}})

    where = {"$and": clauses} if len(clauses) > 1 else (clauses[0] if clauses else None)
    query_text = slots.semantic_query or slots.city or "отель отдых"
    query_emb = await asyncio.to_thread(_embedding_model.encode, [query_text])
    
    kwargs: Dict[str, object] = {
        "query_embeddings": query_emb.tolist(), # type: ignore
        "n_results": min(10, _chroma_collection.count()),
        "include": ["metadatas", "documents", "distances"]
    }
    if where:
        kwargs["where"] = where
        
    res = _chroma_collection.query(**kwargs) # type: ignore
    
    results: List[HotelCardWidget] = []
    raw_metadatas = res.get("metadatas")
    raw_distances = res.get("distances")
    raw_ids = res.get("ids")
    if not raw_metadatas or not raw_distances or not raw_ids:
        return results

    metadatas = raw_metadatas[0]
    distances = raw_distances[0]
    ids = raw_ids[0]

    for i, (meta, dist) in enumerate(zip(metadatas, distances)):
        hotel_id = ids[i]
        hotel = _hotels_by_id.get(hotel_id)
        if not hotel:
            continue
        card = _build_hotel_card(hotel, 1.0 - float(dist), slots)
        results.append(card)
        
    return results[:6]

def _search_in_memory(slots: ExtractedSlots) -> List[HotelCardWidget]:
    scored_hotels: List[tuple[float, HotelFullSchema]] = []
    
    for h in _hotels_dataset:
        score = 0.5
        
        # Строгая фильтрация по городу при наличии
        if slots.city:
            if slots.city.lower() not in h.city.lower():
                continue
            score += 0.2
            
        # Фильтры
        if slots.stars and h.stars >= slots.stars:
            score += 0.1
        if slots.min_rating and h.rating >= slots.min_rating:
            score += 0.1
        if slots.max_price_per_night_rub and h.min_price_per_night_rub <= slots.max_price_per_night_rub:
            score += 0.1
            
        if slots.pet_friendly:
            if not h.amenities.pet_friendly:
                continue
            score += 0.15
            
        if slots.heated_pool:
            if not h.amenities.heated_pool:
                continue
            score += 0.1
            
        if slots.spa and h.amenities.spa:
            score += 0.05
            
        if slots.breakfast_included and h.amenities.breakfast_included_available:
            score += 0.05

        # Семантическое совпадение по описанию и тегам
        q_words = (slots.semantic_query or "").lower().split()
        tag_match = sum(1 for w in q_words if any(w in t.lower() for t in h.tags))
        score += min(0.15, tag_match * 0.05)
        
        scored_hotels.append((min(0.99, round(score, 2)), h))
        
    scored_hotels.sort(key=lambda x: x[0], reverse=True)
    
    cards: List[HotelCardWidget] = []
    for score, h in scored_hotels[:6]:
        cards.append(_build_hotel_card(h, score, slots))
    return cards

def _build_hotel_card(hotel: HotelFullSchema, score: float, slots: ExtractedSlots) -> HotelCardWidget:
    rooms = hotel.room_types
    guests = slots.guests_count or 2
    nights = slots.nights or 2
    pets = 1 if slots.pet_friendly else 0
    
    suitable_rooms = [
        r for r in rooms 
        if (r.capacity.max_total_guests if r.capacity else 2) >= guests
    ]
    chosen_room = suitable_rooms[0] if suitable_rooms else (rooms[0] if rooms else None)
    
    receipt_target_room = chosen_room or RoomType(name="Стандартный номер", price_per_night_rub=hotel.min_price_per_night_rub)
    receipt = calculate_receipt(receipt_target_room, hotel.policies, nights, guests, pets)
    
    return HotelCardWidget(
        id=hotel.id,
        name=hotel.name,
        city=hotel.city,
        stars=hotel.stars,
        area=hotel.area,
        area_type=hotel.area_type,
        address=hotel.address,
        rating=float(hotel.rating),
        reviews_count=hotel.reviews_count,
        image_urls=hotel.image_urls or [
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
        ],
        match_score_pct=max(50, min(99, int(score * 100))),
        tags=hotel.tags[:4],
        min_price_per_night_rub=hotel.min_price_per_night_rub,
        suitable_room=chosen_room,
        receipt=receipt,
        distance_to_beach_m=hotel.location_details.distance_to_beach_m,
        distance_to_ski_lift_m=hotel.location_details.distance_to_ski_lift_m
    )
