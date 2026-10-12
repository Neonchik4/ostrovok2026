import pytest
from app.services.llm_cascade import _mock_extract_slots, _default_chips, _build_deterministic_reasoning
from app.graph.workflow import _pluralize_guests, _pluralize_nights, _pluralize_hotels

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

def test_default_chips_format_actions():
    chips = _default_chips("отель у моря")
    assert len(chips) > 0
    for chip in chips:
        # Чипсы должны быть утверждениями/действиями, а не вопросами
        assert "?" not in chip
        assert not chip.lower().startswith("сколько")
        assert not chip.lower().startswith("какой")
        assert not chip.lower().startswith("в каком")

def test_slots_features_detection():
    query = "Отель в Москве 5 звезд со спа, завтраком и бесплатной отменой"
    slots = _mock_extract_slots(query)
    
    assert slots.city == "Москва"
    assert slots.stars == 5
    assert slots.spa is True
    assert slots.breakfast_included is True

def test_slots_multiple_cities():
    assert _mock_extract_slots("В Питер на выходные").city == "Санкт-Петербург"
    assert _mock_extract_slots("Калининград на двоих").city == "Калининград"
    assert _mock_extract_slots("Поездка в Казань").city == "Казань"

def test_deterministic_reasoning_generation():
    slots = _mock_extract_slots("Красная Поляна с собакой и бассейном до 20000")
    reasoning = _build_deterministic_reasoning("Красная Поляна с собакой и бассейном до 20000", slots)
    
    assert "Красная Поляна" in reasoning
    assert "питомц" in reasoning
    assert "бассейн" in reasoning
    assert "20 000" in reasoning or "20000" in reasoning
    assert len(reasoning) > 50

def test_pluralize_helpers():
    # Гости
    assert _pluralize_guests(1) == "гость"
    assert _pluralize_guests(2) == "гостя"
    assert _pluralize_guests(4) == "гостя"
    assert _pluralize_guests(5) == "гостей"
    assert _pluralize_guests(11) == "гостей"
    assert _pluralize_guests(21) == "гость"

    # Ночи
    assert _pluralize_nights(1) == "ночь"
    assert _pluralize_nights(2) == "ночи"
    assert _pluralize_nights(5) == "ночей"
    assert _pluralize_nights(12) == "ночей"
    assert _pluralize_nights(24) == "ночи"

    # Отели
    assert _pluralize_hotels(1) == "отель"
    assert _pluralize_hotels(2) == "отеля"
    assert _pluralize_hotels(6) == "отелей"
    assert _pluralize_hotels(14) == "отелей"
    assert _pluralize_hotels(21) == "отель"

def test_slot_merging_preserves_city():
    from app.services.session_memory import merge_slots
    from app.schemas.chat import ExtractedSlots

    prev = ExtractedSlots(city="Москва", max_price_per_night_rub=1000000)
    current = ExtractedSlots(city=None, stars=5)
    merged = merge_slots(prev, current)

    assert merged.city == "Москва"
    assert merged.stars == 5
    assert merged.max_price_per_night_rub == 1000000

def test_slot_merging_accumulates_filters():
    from app.services.session_memory import merge_slots
    from app.schemas.chat import ExtractedSlots

    s1 = ExtractedSlots(city="Москва", stars=5)
    s2 = ExtractedSlots(city=None, free_cancellation=True)
    merged = merge_slots(s1, s2)

    assert merged.city == "Москва"
    assert merged.stars == 5
    assert merged.free_cancellation is True

def test_slot_merging_resets_on_explicit_city_switch():
    from app.services.session_memory import merge_slots
    from app.schemas.chat import ExtractedSlots

    prev = ExtractedSlots(city="Москва", stars=5, free_cancellation=True)
    current = ExtractedSlots(city="Казань", stars=None)
    merged = merge_slots(prev, current)

    assert merged.city == "Казань"
    assert merged.stars is None
    assert merged.free_cancellation is None

def test_deterministic_concierge_response_mentions_hotels():
    from app.services.llm_cascade import _build_deterministic_concierge_response
    from app.schemas.chat import ExtractedSlots

    slots = ExtractedSlots(city="Москва", stars=5, free_cancellation=True)
    hotels = [
        type("H", (), {"name": "Классик Спа 119", "city": "Москва", "stars": 5})(),
        type("H", (), {"name": "Арт Лодж 133", "city": "Москва", "stars": 5})(),
    ]
    resp = _build_deterministic_concierge_response("5 звезд", slots, hotels)
    assert "Москва" in resp
    assert "«Классик Спа 119»" in resp
    assert "бесплатной отмены" in resp


def test_sanitize_chips_sub_3000():
    from app.services.llm_cascade import _sanitize_chips
    raw = ["До 2 700 ₽ / ночь", "С теплым бассейном", "До 2700 ₽"]
    cleaned = _sanitize_chips(raw)
    assert "До 5 000 ₽ / ночь" in cleaned
    assert not any("2 700" in c or "2700" in c for c in cleaned)


