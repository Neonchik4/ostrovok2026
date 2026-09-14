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

def _compute_calibrated_match_score(raw_similarity: float, hotel: HotelFullSchema, slots: ExtractedSlots) -> int:
    """
    Качественная калибровка Match Score:
    1. raw_similarity: косинусное сходство (от 0.30 до 0.85)
    2. Плавная нормализация в базовый диапазон [62 .. 88]
    3. Дополнительные баллы за точные совпадения слотов:
       + город (+5)
       + питомцы (+4)
       + бассейн / спа (+3)
       + бюджет в лимите (+3.5)
       + высокий рейтинг гостей (+2)
    4. Итоговый процент: 68% .. 97%, без слипания на 50% или 99%.
    """
    sim = max(0.0, min(1.0, raw_similarity))
    norm = max(0.0, min(1.0, (sim - 0.30) / 0.55))
    base_score = 62.0 + norm * 26.0

    bonus = 0.0
    if slots.city and slots.city.lower() in hotel.city.lower():
        bonus += 5.0
    if slots.pet_friendly and hotel.amenities.pet_friendly:
        bonus += 4.0
    if slots.heated_pool and hotel.amenities.heated_pool:
        bonus += 3.0
    if slots.spa and hotel.amenities.spa:
        bonus += 2.5
    if slots.max_price_per_night_rub and hotel.min_price_per_night_rub <= slots.max_price_per_night_rub:
        bonus += 3.5
    if hotel.rating >= 9.0:
        bonus += 2.0
    elif hotel.rating >= 8.0:
        bonus += 1.0

    final_pct = int(round(base_score + bonus))
    return max(65, min(97, final_pct))

async def _search_chroma(slots: ExtractedSlots) -> List[HotelCardWidget]:
    if _chroma_collection is None or _embedding_model is None:
        return []

    # Строим семантический запрос из слотов
    query_parts = []
    if slots.city:
        query_parts.append(f"город {slots.city}")
    if slots.area_type:
        query_parts.append(slots.area_type)
    if slots.pet_friendly:
        query_parts.append("проживание с собакой питомцем pet-friendly")
    if slots.heated_pool:
        query_parts.append("подогреваемый теплый бассейн")
    if slots.spa:
        query_parts.append("спа центр сауна")
    if slots.semantic_query:
        query_parts.append(slots.semantic_query)

    query_text = " ".join(query_parts) if query_parts else (slots.city or "отель отдых")
    query_emb = await asyncio.to_thread(_embedding_model.encode, [query_text])

    # Запрашиваем пул кандидатов из ChromaDB v2
    n_query = min(50, _chroma_collection.count())
    res = _chroma_collection.query(
        query_embeddings=query_emb.tolist(),
        n_results=n_query,
        include=["metadatas", "distances"]
    )

    raw_metadatas = res.get("metadatas")
    raw_distances = res.get("distances")
    raw_ids = res.get("ids")
    if not raw_metadatas or not raw_distances or not raw_ids:
        return _search_in_memory(slots)

    metadatas = raw_metadatas[0]
    distances = raw_distances[0]
    ids = raw_ids[0]

    scored_candidates = []
    for i in range(len(ids)):
        h_id = ids[i]
        hotel = _hotels_by_id.get(h_id)
        if not hotel:
            continue

        # Фильтр по городу (подстрока, регистронезависимо)
        if slots.city and slots.city.lower() not in hotel.city.lower():
            continue

        # Детерминированные фильтры
        if slots.stars and hotel.stars < slots.stars:
            continue
        if slots.min_rating and hotel.rating < slots.min_rating:
            continue
        if slots.max_price_per_night_rub and hotel.min_price_per_night_rub > slots.max_price_per_night_rub:
            continue
        if slots.pet_friendly and not hotel.amenities.pet_friendly:
            continue
        if slots.heated_pool and not hotel.amenities.heated_pool:
            continue
        if slots.spa and not hotel.amenities.spa:
            continue

        dist = distances[i]
        raw_sim = 1.0 - float(dist)
        score_pct = _compute_calibrated_match_score(raw_sim, hotel, slots)
        scored_candidates.append((score_pct, hotel))

    scored_candidates.sort(key=lambda x: x[0], reverse=True)

    cards: List[HotelCardWidget] = []
    for score_pct, hotel in scored_candidates[:6]:
        cards.append(_build_hotel_card(hotel, float(score_pct), slots))

    # Если строгие фильтры оставили 0 отелей — умное ослабление
    if not cards:
        cards = _search_relaxed(slots)

    return cards

def _search_in_memory(slots: ExtractedSlots) -> List[HotelCardWidget]:
    scored_hotels: List[tuple[int, HotelFullSchema]] = []
    
    for h in _hotels_dataset:
        if slots.city and slots.city.lower() not in h.city.lower():
            continue

        if slots.stars and h.stars < slots.stars:
            continue
        if slots.min_rating and h.rating < slots.min_rating:
            continue
        if slots.max_price_per_night_rub and h.min_price_per_night_rub > slots.max_price_per_night_rub:
            continue
        if slots.pet_friendly and not h.amenities.pet_friendly:
            continue
        if slots.heated_pool and not h.amenities.heated_pool:
            continue
        if slots.spa and not h.amenities.spa:
            continue

        # Семантическая оценка по тегам и названию
        q_words = (slots.semantic_query or "").lower().split()
        tag_match = sum(1 for w in q_words if any(w in t.lower() for t in h.tags))
        raw_sim = 0.55 + min(0.30, tag_match * 0.08)

        score_pct = _compute_calibrated_match_score(raw_sim, h, slots)
        scored_hotels.append((score_pct, h))
        
    scored_hotels.sort(key=lambda x: x[0], reverse=True)
    
    cards: List[HotelCardWidget] = []
    for score_pct, h in scored_hotels[:6]:
        cards.append(_build_hotel_card(h, float(score_pct), slots))

    if not cards and _hotels_dataset:
        cards = _search_relaxed(slots)

    return cards

def _search_relaxed(slots: ExtractedSlots) -> List[HotelCardWidget]:
    """
    Умное ослабление ограничений (Smart Relaxation):
    Если строгие фильтры не дали результатов, подбирает наилучшие альтернативы
    в том же городе/регионе, максимально удовлетворяющие остальным критериям.
    """
    candidates = []
    for h in _hotels_dataset:
        if slots.city and slots.city.lower() not in h.city.lower():
            continue

        match_pct = 70
        if slots.pet_friendly and h.amenities.pet_friendly:
            match_pct += 8
        if slots.heated_pool and h.amenities.heated_pool:
            match_pct += 7
        if slots.spa and h.amenities.spa:
            match_pct += 5
        if slots.stars and h.stars >= slots.stars:
            match_pct += 4

        if slots.max_price_per_night_rub and h.min_price_per_night_rub > slots.max_price_per_night_rub:
            diff = h.min_price_per_night_rub - slots.max_price_per_night_rub
            penalty = int(min(15, (diff / max(slots.max_price_per_night_rub, 1000)) * 10))
            match_pct -= penalty

        score_val = max(62, min(92, match_pct))
        candidates.append((score_val, h.min_price_per_night_rub, -float(h.rating), h))

    if not candidates:
        for h in _hotels_dataset:
            score_val = 72
            if slots.pet_friendly and h.amenities.pet_friendly:
                score_val += 8
            if slots.heated_pool and h.amenities.heated_pool:
                score_val += 7
            candidates.append((score_val, h.min_price_per_night_rub, -float(h.rating), h))

    candidates.sort(key=lambda x: (-x[0], x[1], x[2]))

    cards: List[HotelCardWidget] = []
    for score_pct, _, _, h in candidates[:6]:
        cards.append(_build_hotel_card(h, float(score_pct), slots))
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
    
    # Качественный процент совпадения
    if score > 1.0:
        match_score_pct = int(round(score))
    else:
        match_score_pct = _compute_calibrated_match_score(score, hotel, slots)

    match_score_pct = max(65, min(98, match_score_pct))

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
        match_score_pct=match_score_pct,
        tags=hotel.tags[:4],
        min_price_per_night_rub=hotel.min_price_per_night_rub,
        suitable_room=chosen_room,
        receipt=receipt,
        distance_to_beach_m=hotel.location_details.distance_to_beach_m,
        distance_to_ski_lift_m=hotel.location_details.distance_to_ski_lift_m
    )
