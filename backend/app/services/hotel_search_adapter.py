"""
Hotel Search Adapter Facade.
Оркестрирует гибридный поиск отелей, объединяя векторное хранилище (ChromaDB)
и детерминированные фильтры с расчетом прозрачного чека.
Декомпозирован на:
- vector_store.py (ChromaDB, SentenceTransformer, кэширование датасета)
- hotel_filters.py (скалярная фильтрация, калибровка скора, relaxation, чеки)
"""

from typing import List, Tuple
from ..schemas.chat import ExtractedSlots, HotelCardWidget, SearchTelemetry
from ..schemas.hotel_models import HotelFullSchema
from .vector_store import (
    init_dataset,
    warmup_models,
    get_hotels_dataset,
    get_hotel_by_id,
    is_vector_ready,
    query_chroma_raw,
)
from .hotel_filters import (
    compute_calibrated_match_score,
    matches_scalar_filters,
    build_hotel_card,
    search_in_memory,
    search_in_memory_with_telemetry,
    search_relaxed,
)

async def _search_chroma_with_telemetry(slots: ExtractedSlots) -> Tuple[List[HotelCardWidget], SearchTelemetry]:
    """Векторный поиск по ChromaDB с последующей жесткой фильтрацией и телеметрией."""
    dataset = get_hotels_dataset()
    total_in_region = sum(1 for h in dataset if (not slots.city or slots.city.lower() in h.city.lower()))

    if not is_vector_ready():
        return search_in_memory_with_telemetry(dataset, slots)

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
    res = await query_chroma_raw(query_text, n_results=50)

    if not res or not res.get("metadatas") or not res.get("distances") or not res.get("ids"):
        cards, telem = search_in_memory_with_telemetry(dataset, slots)
        telem.engine = "In-Memory (Chroma Fallback)"
        return cards, telem

    distances = res["distances"][0]
    ids = res["ids"][0]

    scored_candidates = []
    scalar_matched = 0
    for i in range(len(ids)):
        h_id = ids[i]
        hotel = get_hotel_by_id(h_id)
        if not hotel:
            continue

        if not matches_scalar_filters(hotel, slots):
            continue
        scalar_matched += 1

        dist = distances[i]
        raw_sim = 1.0 - float(dist)
        score_pct = compute_calibrated_match_score(raw_sim, hotel, slots)
        scored_candidates.append((score_pct, hotel))

    scored_candidates.sort(key=lambda x: x[0], reverse=True)

    cards: List[HotelCardWidget] = []
    for score_pct, hotel in scored_candidates[:6]:
        cards.append(build_hotel_card(hotel, float(score_pct), slots))

    is_relaxed = False
    if not cards:
        cards = search_relaxed(dataset, slots)
        is_relaxed = True

    top_score = cards[0].match_score_pct if cards else 0
    min_price = min((c.min_price_per_night_rub for c in cards), default=0)

    telemetry = SearchTelemetry(
        engine="ChromaDB (HNSW)",
        total_evaluated=len(ids),
        total_in_region=total_in_region,
        scalar_matched=scalar_matched,
        is_relaxed=is_relaxed,
        top_score_pct=top_score,
        min_price_rub=min_price,
    )
    return cards, telemetry

async def _search_chroma(slots: ExtractedSlots) -> List[HotelCardWidget]:
    cards, _ = await _search_chroma_with_telemetry(slots)
    return cards

async def search_hotels_with_telemetry(slots: ExtractedSlots) -> Tuple[List[HotelCardWidget], SearchTelemetry]:
    """
    Гибридный отказоустойчивый поиск с детальной телеметрией:
    1. Если доступна ChromaDB + SentenceTransformer -> Векторный + метаданные
    2. Иначе -> Быстрый детерминированный in-memory поиск по 2 600+ отелям с расчетом match_score
    """
    init_dataset()
    dataset = get_hotels_dataset()
    if not dataset:
        return [], SearchTelemetry(engine="Empty Dataset")

    # 1. Попытка через ChromaDB
    if is_vector_ready():
        try:
            return await _search_chroma_with_telemetry(slots)
        except Exception as e:
            print(f"[Search Fallback] Ошибка ChromaDB ({e}), переключение на in-memory...")

    # 2. In-Memory фильтрация и скоринг
    return search_in_memory_with_telemetry(dataset, slots)

async def search_hotels_unified(slots: ExtractedSlots) -> List[HotelCardWidget]:
    cards, _ = await search_hotels_with_telemetry(slots)
    return cards

# Псевдонимы для обратной совместимости
_compute_calibrated_match_score = compute_calibrated_match_score
_build_hotel_card = build_hotel_card
_search_in_memory = lambda slots: search_in_memory(get_hotels_dataset(), slots)
_search_relaxed = lambda slots: search_relaxed(get_hotels_dataset(), slots)

__all__ = [
    "search_hotels_unified",
    "search_hotels_with_telemetry",
    "warmup_models",
    "init_dataset",
    "compute_calibrated_match_score",
    "build_hotel_card",
    "_search_chroma",
    "_search_in_memory",
    "_search_relaxed",
    "_compute_calibrated_match_score",
    "_build_hotel_card",
]
