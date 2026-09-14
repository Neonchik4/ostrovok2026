import pytest
from app.services.text_helpers import (
    pluralize_guests,
    pluralize_nights,
    pluralize_hotels,
    sanitize_user_input,
)

def test_pluralize_guests_rules():
    assert pluralize_guests(1) == "гость"
    assert pluralize_guests(21) == "гость"
    assert pluralize_guests(101) == "гость"

    assert pluralize_guests(2) == "гостя"
    assert pluralize_guests(3) == "гостя"
    assert pluralize_guests(4) == "гостя"
    assert pluralize_guests(22) == "гостя"

    assert pluralize_guests(5) == "гостей"
    assert pluralize_guests(11) == "гостей"
    assert pluralize_guests(12) == "гостей"
    assert pluralize_guests(14) == "гостей"
    assert pluralize_guests(20) == "гостей"

def test_pluralize_nights_rules():
    assert pluralize_nights(1) == "ночь"
    assert pluralize_nights(21) == "ночь"
    assert pluralize_nights(2) == "ночи"
    assert pluralize_nights(4) == "ночи"
    assert pluralize_nights(5) == "ночей"
    assert pluralize_nights(11) == "ночей"
    assert pluralize_nights(12) == "ночей"
    assert pluralize_nights(25) == "ночей"

def test_pluralize_hotels_rules():
    assert pluralize_hotels(1) == "отель"
    assert pluralize_hotels(21) == "отель"
    assert pluralize_hotels(2) == "отеля"
    assert pluralize_hotels(4) == "отеля"
    assert pluralize_hotels(5) == "отелей"
    assert pluralize_hotels(13) == "отелей"

def test_sanitize_user_input():
    # Удаление null-байтов
    assert sanitize_user_input("hello\x00world") == "helloworld"
    # Ограничение длины
    long_text = "a" * 1500
    sanitized = sanitize_user_input(long_text, max_length=1000)
    assert len(sanitized) == 1000
    # Пустая строка
    assert sanitize_user_input("") == ""
    assert sanitize_user_input(None) == ""
