import pytest
from app.schemas.chat import ExtractedSlots, HotelCardWidget
from app.services.hotel_filters import (
    evaluate_criteria_breakdown,
    build_hotel_card,
    search_relaxed,
)
from tests.fixtures.synthetic_hotels import get_synthetic_test_hotels


def test_evaluate_criteria_breakdown_strict_match():
    hotels = get_synthetic_test_hotels()
    hotel = hotels[0]  # Сочи Спа Резорт: Сочи, 12 000 руб, 5 звезд, рейтинг 9.4, pet=True, heated_pool=True, spa=True

    slots = ExtractedSlots(
        city="Сочи",
        max_price_per_night_rub=15000,
        stars=4,
        pet_friendly=True,
        heated_pool=True,
        spa=True,
        min_rating=9.0,
        semantic_query="красивый вид на море",
    )

    breakdown, compromise = evaluate_criteria_breakdown(hotel, slots, is_relaxed=False)

    assert compromise is None
    criteria_map = {c.criterion: c for c in breakdown}

    assert "Локация" in criteria_map
    assert criteria_map["Локация"].status == "code_verified"
    assert criteria_map["Локация"].is_positive is True
    assert "Сочи" in criteria_map["Локация"].evidence

    assert "Бюджет" in criteria_map
    assert criteria_map["Бюджет"].status == "code_verified"
    assert criteria_map["Бюджет"].is_positive is True
    assert "12 000" in criteria_map["Бюджет"].evidence

    assert "Питомцы" in criteria_map
    assert criteria_map["Питомцы"].status == "code_verified"
    assert criteria_map["Питомцы"].is_positive is True

    assert "Бассейн" in criteria_map
    assert criteria_map["Бассейн"].status == "code_verified"
    assert criteria_map["Бассейн"].is_positive is True

    assert "СПА-центр" in criteria_map
    assert criteria_map["СПА-центр"].status == "code_verified"

    assert "Категория" in criteria_map
    assert criteria_map["Категория"].status == "code_verified"

    assert "Рейтинг гостей" in criteria_map
    assert criteria_map["Рейтинг гостей"].status == "code_verified"

    assert "Атмосфера и пожелания" in criteria_map
    assert criteria_map["Атмосфера и пожелания"].status == "semantic_match"


def test_evaluate_criteria_breakdown_smart_relaxation_compromise():
    hotels = get_synthetic_test_hotels()
    hotel = hotels[0]  # Сочи Спа Резорт, цена 12 000 руб

    # Пользователь запросил жесткий лимит 8 000 руб
    slots = ExtractedSlots(
        city="Сочи",
        max_price_per_night_rub=8000,
        pet_friendly=True,
    )

    breakdown, compromise = evaluate_criteria_breakdown(hotel, slots, is_relaxed=True)

    assert compromise is not None
    assert "Бюджет превышен" in compromise
    assert "4 000" in compromise

    criteria_map = {c.criterion: c for c in breakdown}
    assert "Бюджет" in criteria_map
    assert criteria_map["Бюджет"].status == "relaxed_compromise"
    assert criteria_map["Бюджет"].is_positive is False
    assert "Превышение" in criteria_map["Бюджет"].evidence


def test_build_hotel_card_populates_breakdown_and_compromise():
    hotels = get_synthetic_test_hotels()
    hotel = hotels[0]

    slots = ExtractedSlots(
        city="Сочи",
        max_price_per_night_rub=10000,
        pet_friendly=True,
    )

    # When is_relaxed=True
    card = build_hotel_card(hotel, 88.0, slots, is_relaxed=True)
    assert isinstance(card, HotelCardWidget)
    assert len(card.criteria_breakdown) > 0
    assert card.compromise_note is not None
    assert "Бюджет превышен" in card.compromise_note

    # Verify serialization
    data = card.model_dump()
    assert "criteria_breakdown" in data
    assert len(data["criteria_breakdown"]) > 0
    assert data["compromise_note"] is not None


def test_empty_slots_fallback_breakdown():
    hotels = get_synthetic_test_hotels()
    hotel = hotels[0]

    slots = ExtractedSlots()
    breakdown, compromise = evaluate_criteria_breakdown(hotel, slots, is_relaxed=False)

    assert compromise is None
    criteria_names = [c.criterion for c in breakdown]
    assert "Рейтинг" in criteria_names
    assert "Локация" in criteria_names


def test_search_relaxed_attaches_compromise_notes():
    dataset = get_synthetic_test_hotels()
    slots = ExtractedSlots(
        city="Сочи",
        max_price_per_night_rub=2000,  # Отели в синтетике дороже 2000 руб
    )

    cards = search_relaxed(dataset, slots)
    assert len(cards) > 0
    # Every relaxed card should carry a compromise note
    assert cards[0].compromise_note is not None
    assert "Бюджет превышен" in cards[0].compromise_note
