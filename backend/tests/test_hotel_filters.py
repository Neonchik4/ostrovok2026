import pytest
from app.services.hotel_filters import (
    compute_calibrated_match_score,
    matches_scalar_filters,
    search_relaxed,
)
from app.services.slot_extractor import mock_extract_slots
from app.services.vector_store import get_hotels_dataset

def test_compute_calibrated_match_score_bounds():
    dataset = get_hotels_dataset()
    assert len(dataset) > 0
    hotel = dataset[0]
    slots = mock_extract_slots("Отель в Сочи")

    score_low = compute_calibrated_match_score(0.0, hotel, slots)
    assert 65 <= score_low <= 98

    score_high = compute_calibrated_match_score(1.0, hotel, slots)
    assert 65 <= score_high <= 98
    assert score_high >= score_low

def test_matches_scalar_filters():
    dataset = get_hotels_dataset()
    hotel = dataset[0]

    # Фильтр по городу
    slots_match = mock_extract_slots(f"Отель в {hotel.city}")
    assert matches_scalar_filters(hotel, slots_match) is True

    # Другой город
    other_city = "Сочи" if hotel.city != "Сочи" else "Санкт-Петербург"
    slots_no_match = mock_extract_slots(f"Отель в {other_city}")
    assert matches_scalar_filters(hotel, slots_no_match) is False

def test_search_relaxed_candidates():
    dataset = get_hotels_dataset()
    # Запрос с нереалистично низким бюджетом
    slots = mock_extract_slots("Красная Поляна до 500 рублей")
    cards = search_relaxed(dataset, slots)
    assert len(cards) > 0
    for card in cards:
        assert card.receipt is not None
