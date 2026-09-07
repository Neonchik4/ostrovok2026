import pytest
from app.services.llm_cascade import _mock_extract_slots

def test_mock_slot_extraction():
    query = "Ищу отель в Красной Поляне с подогреваемым бассейном для 3 человек с собакой до 15000 руб"
    slots = _mock_extract_slots(query)
    
    assert slots.city == "Красная Поляна"
    assert slots.heated_pool is True
    assert slots.pet_friendly is True
    assert slots.guests_count == 3
    assert slots.max_price_per_night_rub == 15000

def test_mock_fallback_defaults():
    query = "Хочу в Сочи отдохнуть"
    slots = _mock_extract_slots(query)
    
    assert slots.city == "Сочи"
    assert slots.guests_count == 2
    assert len(slots.disambiguation_suggestions) > 0
