import pytest
from app.services.slot_extractor import (
    mock_extract_slots,
    sanitize_chips,
    default_chips,
)

def test_mock_extract_slots_bounds():
    # Проверка клампинга гостей и ночей
    slots = mock_extract_slots("Отель в Москве на 50 человек на 150 ночей")
    assert slots.guests_count <= 20
    assert slots.nights <= 90

    # Проверка звезд
    slots_5 = mock_extract_slots("Отель в Сочи 5 звезд")
    assert slots_5.stars == 5

def test_mock_extract_slots_features():
    query = "Красная Поляна со спа, подогреваемым бассейном, завтраком и собакой до 25000 руб"
    slots = mock_extract_slots(query)
    assert slots.city == "Красная Поляна"
    assert slots.spa is True
    assert slots.heated_pool is True
    assert slots.breakfast_included is True
    assert slots.pet_friendly is True
    assert slots.max_price_per_night_rub == 25000

def test_sanitize_chips_security_and_prices():
    raw_chips = [
        "До 1 500 ₽ / ночь",
        "До 1 500 ₽ / ночь",  # дубликат
        "Слишком длинный чипс " * 10,
        "Только с завтраком",
    ]
    cleaned = sanitize_chips(raw_chips)
    assert len(cleaned) == 2
    assert "До 5 000 ₽ / ночь" in cleaned
    assert "Только с завтраком" in cleaned

def test_default_chips_action_format():
    chips = default_chips("отель у моря")
    assert len(chips) > 0
    for chip in chips:
        assert "?" not in chip
        assert not chip.startswith("Где")
