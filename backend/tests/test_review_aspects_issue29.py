import pytest
from tests.fixtures.synthetic_hotels import get_synthetic_test_hotels

from app.schemas.chat import ExtractedSlots
from app.services.hotel_filters import build_hotel_card
from app.services.response_generator import build_deterministic_agent_response
from app.services.session_memory import merge_slots
from app.services.slot_extractor import mock_extract_slots
from app.services.tag_reviews import build_hotel_review_summary
from app.services.vector_store import get_hotels_dataset, init_dataset


@pytest.fixture(scope="module", autouse=True)
def ensure_dataset():
    init_dataset()


def test_build_hotel_review_summary_structure():
    mock_hotel = {
        "id": "h-test-1",
        "name": "Гранд Тест Отель",
        "rating": 8.8,
        "reviews_count": 142,
        "top_reviews": [
            {
                "plus": "Прекрасный шведский стол с горячими круассанами. До пляжа 5 минут пешком. Очень вежливый персонал на ресепшен.",
                "minus": "Шум с центральной улицы по ночам. Лифт в часы пик долго ждать.",
            }
        ],
    }

    summary = build_hotel_review_summary(mock_hotel)

    assert summary.rating == 8.8
    assert summary.reviews_count == 142
    assert isinstance(summary.pros, list)
    assert isinstance(summary.cons, list)
    assert 1 <= len(summary.pros) <= 3
    assert 1 <= len(summary.cons) <= 2
    assert any("пляж" in p.lower() or "стол" in p.lower() or "персонал" in p.lower() for p in summary.pros)
    assert any("шум" in c.lower() or "лифт" in c.lower() for c in summary.cons)


def test_slot_extractor_detects_review_inquiry_intent():
    queries = [
        "чё по отзывам?",
        "какие отзывы об отеле?",
        "какие минусы у отеля?",
        "что пишут в отзывах гости?",
    ]
    for q in queries:
        slots = mock_extract_slots(q)
        assert slots.is_review_inquiry is True
        assert slots.intent == "review_inquiry"


def test_multi_turn_preserves_city_on_review_inquiry():
    prev = mock_extract_slots("Отели в Сочи с бассейном")
    assert prev.city == "Сочи"

    inquiry = mock_extract_slots("чё по отзывам?")
    assert inquiry.is_review_inquiry is True
    assert inquiry.city is None

    merged = merge_slots(prev, inquiry)
    assert merged.city == "Сочи"
    assert merged.is_review_inquiry is True


def test_agent_response_for_review_inquiry():
    dataset = get_hotels_dataset() or get_synthetic_test_hotels()
    assert len(dataset) > 0
    hotel = dataset[0]

    slots = ExtractedSlots(
        city=hotel.city,
        is_review_inquiry=True,
        intent="review_inquiry",
    )

    card = build_hotel_card(hotel, 92.0, slots)
    assert card.review_summary is not None
    assert card.review_summary.rating > 0

    response = build_deterministic_agent_response("чё по отзывам?", slots, [card])
    assert f"«{card.name}»" in response
    assert "плюсы" in response.lower()
    assert "минусы" in response.lower()


def test_build_hotel_card_populates_review_summary():
    dataset = get_hotels_dataset() or get_synthetic_test_hotels()
    hotel = dataset[0]
    slots = ExtractedSlots(city=hotel.city)
    card = build_hotel_card(hotel, 88.0, slots)

    assert card.review_summary is not None
    assert isinstance(card.review_summary.pros, list)
    assert isinstance(card.review_summary.cons, list)
    assert card.review_summary.reviews_count >= 0
