import pytest
from app.services.thought_generator import build_deterministic_reasoning
from app.services.response_generator import build_deterministic_concierge_response
from app.services.slot_extractor import mock_extract_slots
from app.schemas.chat import HotelCardWidget

def test_thought_reasoning_richness():
    slots = mock_extract_slots("Отель в Санкт-Петербурге с кошкой и спа до 12000 р")
    reasoning = build_deterministic_reasoning("Отель в Санкт-Петербурге с кошкой и спа до 12000 р", slots)
    assert "Санкт-Петербург" in reasoning
    assert "питомц" in reasoning
    assert "СПА" in reasoning or "спа" in reasoning
    assert "12 000" in reasoning

def test_concierge_response_empty_hotels():
    slots = mock_extract_slots("Отель в Москве")
    resp = build_deterministic_concierge_response("Отель в Москве", slots, [])
    assert "не найдены" in resp
    assert "Москва" in resp

def test_concierge_response_budget_exceeded():
    slots = mock_extract_slots("Отель в Сочи до 3000 руб")
    class DummyHotel:
        name = "Гранд Отель"
        city = "Сочи"
        min_price_per_night_rub = 6000
    dummy = DummyHotel()

    resp = build_deterministic_concierge_response("Отель в Сочи до 3000 руб", slots, [dummy])
    assert "В рамках бюджета" in resp
    assert "6 000" in resp
