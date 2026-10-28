"""
Тестирование Few-Shot промптов и поведения агента на цепочках из 2, 3, 4, 5 и 10 сообщений.

Проверяет:
- Наличие, синтаксическую валидность и полноту Few-Shot примеров в SYSTEM_EXTRACTOR_PROMPT;
- Поведение NLU-пайплайна при пошаговом наращивании контекста (2, 3, 4, 5, 10 сообщений);
- Стабильность экстракции ключевых слотов при диалоговых уточнениях;
- Инварианты Zero-Emoji во входящих промптах и результирующих структурах.
"""

import json
import re

from app.schemas.chat import ExtractedSlots
from app.services.session_memory import merge_slots
from app.services.slot_extractor import (
    SYSTEM_EXTRACTOR_PROMPT,
    mock_extract_slots,
)


def test_few_shot_prompt_examples_structure():
    """Проверка структуры и валидности Few-Shot примеров в системном промпте."""
    assert "Примеры (Few-Shot)" in SYSTEM_EXTRACTOR_PROMPT
    for idx in range(1, 9):
        assert f"Пример {idx}" in SYSTEM_EXTRACTOR_PROMPT

    # Извлекаем все JSON блоки ответов из примеров и валидируем через ExtractedSlots
    json_blocks = re.findall(r"Ответ:\s*(\{[^\n]+\})", SYSTEM_EXTRACTOR_PROMPT)
    assert len(json_blocks) >= 8, "Должно быть минимум 8 валидных JSON примеров"

    for block in json_blocks:
        parsed = json.loads(block)
        slots = ExtractedSlots.model_validate(parsed)
        assert isinstance(slots, ExtractedSlots)


def test_few_shot_dialogue_two_messages():
    """Тестирование цепочки из 2 сообщений (начало + уточнение фильтра)."""
    t1 = mock_extract_slots("Ищем отель в Казани на 3 ночи")
    assert t1.city == "Казань"
    assert t1.nights == 3

    t2 = mock_extract_slots("только с завтраком")
    assert t2.breakfast_included is True

    merged = merge_slots(t1, t2)
    assert merged.city == "Казань"
    assert merged.nights == 3
    assert merged.breakfast_included is True


def test_few_shot_dialogue_three_messages():
    """Тестирование цепочки из 3 сообщений (+ ограничение бюджета)."""
    s = mock_extract_slots("Отель в Санкт-Петербурге для двоих")
    s = merge_slots(s, mock_extract_slots("с бассейном"))
    s = merge_slots(s, mock_extract_slots("дешевле 9000 руб за ночь"))

    assert s.city == "Санкт-Петербург"
    assert s.guests_count == 2
    assert s.heated_pool is True
    assert s.max_price_per_night_rub == 9000


def test_few_shot_dialogue_four_messages():
    """Тестирование цепочки из 4 сообщений (+ питомец)."""
    s = mock_extract_slots("Хочу в Сочи на неделю")
    s = merge_slots(s, mock_extract_slots("только 4 звезды"))
    s = merge_slots(s, mock_extract_slots("до 15000 рублей"))
    s = merge_slots(s, mock_extract_slots("едем с собакой"))

    assert s.city == "Сочи"
    assert s.nights == 7
    assert s.stars == 4
    assert s.max_price_per_night_rub == 15000
    assert s.pet_friendly is True


def test_few_shot_dialogue_five_messages():
    """Тестирование цепочки из 5 сообщений (+ сдвиг дат)."""
    s = mock_extract_slots("Отель в Москве с 10 по 15 июля для 3 человек")
    assert s.city == "Москва"
    assert s.guests_count == 3
    assert s.nights == 5
    init_date = s.depart_date

    s = merge_slots(s, mock_extract_slots("только с завтраком"))
    s = merge_slots(s, mock_extract_slots("бюджет до 8000 за ночь"))
    s = merge_slots(s, mock_extract_slots("нужен поздний выезд в 18:00"))
    assert s.needs_late_checkout is True

    s = merge_slots(s, mock_extract_slots("а если на 2 дня позже?"))
    assert s.city == "Москва"
    assert s.guests_count == 3
    assert s.nights == 5
    assert s.breakfast_included is True
    assert s.max_price_per_night_rub == 8000
    if init_date:
        from datetime import datetime, timedelta
        expected_shifted = (datetime.strptime(init_date, "%Y-%m-%d") + timedelta(days=2)).strftime("%Y-%m-%d")
        assert s.depart_date == expected_shifted


def test_few_shot_dialogue_six_messages():
    """Тестирование цепочки из 6 сообщений (+ запрос отзывов)."""
    s = mock_extract_slots("Отель в Сочи на 4 человек с 10 по 15 июля")
    s = merge_slots(s, mock_extract_slots("только с завтраком"))
    s = merge_slots(s, mock_extract_slots("дешевле 8000 руб"))
    s = merge_slots(s, mock_extract_slots("едем с собакой"))
    s = merge_slots(s, mock_extract_slots("а если на 2 дня позже?"))
    s = merge_slots(s, mock_extract_slots("чё по отзывам об этом отеле?"))

    assert s.city == "Сочи"
    assert s.guests_count == 4
    assert s.breakfast_included is True
    assert s.max_price_per_night_rub == 8000
    assert s.pet_friendly is True
    assert s.is_review_inquiry is True


def test_few_shot_dialogue_seven_messages():
    """Тестирование цепочки из 7 сообщений (+ логистика вокзала)."""
    s = mock_extract_slots("Отель в Сочи на 4 человек с 10 по 15 июля")
    s = merge_slots(s, mock_extract_slots("только с завтраком"))
    s = merge_slots(s, mock_extract_slots("дешевле 8000 руб"))
    s = merge_slots(s, mock_extract_slots("едем с собакой"))
    s = merge_slots(s, mock_extract_slots("а если на 2 дня позже?"))
    s = merge_slots(s, mock_extract_slots("чё по отзывам об этом отеле?"))
    s = merge_slots(s, mock_extract_slots("сколько такси от вокзала?"))

    assert s.city == "Сочи"
    assert s.guests_count == 4
    assert s.near_station is True
    assert s.is_review_inquiry is False  # Сброшен флаг ревью на следующем ходе


def test_few_shot_dialogue_eight_messages():
    """Тестирование цепочки из 8 сообщений (+ ранний заезд)."""
    s = mock_extract_slots("Отель в Сочи на 4 человек с 10 по 15 июля")
    s = merge_slots(s, mock_extract_slots("только с завтраком"))
    s = merge_slots(s, mock_extract_slots("дешевле 8000 руб"))
    s = merge_slots(s, mock_extract_slots("едем с собакой"))
    s = merge_slots(s, mock_extract_slots("а если на 2 дня позже?"))
    s = merge_slots(s, mock_extract_slots("чё по отзывам об этом отеле?"))
    s = merge_slots(s, mock_extract_slots("сколько такси от вокзала?"))
    s = merge_slots(s, mock_extract_slots("можно заехать в 10 утра?"))

    assert s.city == "Сочи"
    assert s.arrival_time == "10:00"
    assert s.needs_early_checkin is True


def test_few_shot_dialogue_nine_messages():
    """Тестирование цепочки из 9 сообщений (+ обоснование стоимости)."""
    s = mock_extract_slots("Отель в Сочи на 4 человек с 10 по 15 июля")
    s = merge_slots(s, mock_extract_slots("только с завтраком"))
    s = merge_slots(s, mock_extract_slots("дешевле 8000 руб"))
    s = merge_slots(s, mock_extract_slots("едем с собакой"))
    s = merge_slots(s, mock_extract_slots("а если на 2 дня позже?"))
    s = merge_slots(s, mock_extract_slots("чё по отзывам об этом отеле?"))
    s = merge_slots(s, mock_extract_slots("сколько такси от вокзала?"))
    s = merge_slots(s, mock_extract_slots("можно заехать в 10 утра?"))
    s = merge_slots(s, mock_extract_slots("почему этот отель дороже?"))

    assert s.city == "Сочи"
    assert s.guests_count == 4
    assert s.max_price_per_night_rub == 8000
    assert s.pet_friendly is True


def test_few_shot_dialogue_ten_messages():
    """Тестирование полной цепочки из 10 сообщений подряд без потери слотов."""
    history_prompts = [
        "Хочу отель в Сочи на 4 человек с 10 по 15 июля",
        "только с завтраком",
        "дешевле 8000 руб",
        "едем с собакой",
        "а если на 2 дня позже?",
        "чё по отзывам об этом отеле?",
        "сколько такси от вокзала?",
        "можно заехать в 10 утра?",
        "почему этот отель дороже?",
        "бронирую первый вариант",
    ]

    current_slots: ExtractedSlots | None = None
    for turn_idx, text in enumerate(history_prompts, start=1):
        step_slots = mock_extract_slots(text)
        current_slots = merge_slots(current_slots, step_slots)

        # Инварианты каждого хода
        assert current_slots.city == "Сочи", f"City wiped on turn {turn_idx}"
        assert current_slots.guests_count == 4, f"Guests corrupted on turn {turn_idx}"

        if turn_idx >= 2:
            assert current_slots.breakfast_included is True
        if turn_idx >= 3:
            assert current_slots.max_price_per_night_rub == 8000
        if turn_idx >= 4:
            assert current_slots.pet_friendly is True
        if turn_idx == 6:
            assert current_slots.is_review_inquiry is True
        if turn_idx >= 7:
            assert current_slots.near_station is True
        if turn_idx >= 8:
            assert current_slots.arrival_time == "10:00"
            assert current_slots.needs_early_checkin is True

    # Итог на 10 ходу: все ключевые параметры сохранены
    assert current_slots.city == "Сочи"
    assert current_slots.guests_count == 4
    assert current_slots.nights == 5
    assert current_slots.breakfast_included is True
    assert current_slots.max_price_per_night_rub == 8000
    assert current_slots.pet_friendly is True
    assert current_slots.near_station is True
    assert current_slots.arrival_time == "10:00"


def test_few_shot_cross_month_and_year_night_calculation():
    """Тестирование расчета ночей через границы месяцев и через Новый год."""
    s1 = mock_extract_slots("с 30 декабря 2026 по 5 января 2027")
    assert s1.depart_date == "2026-12-30"
    assert s1.nights == 6

    s2 = mock_extract_slots("с 28 февраля по 5 марта")
    assert s2.nights == 5

    s3 = mock_extract_slots("25 ноября 2026 — 1 декабря 2026")
    assert s3.depart_date == "2026-11-25"
    assert s3.nights == 6


def test_zero_emoji_in_few_shot_prompt():
    """Zero-Emoji: проверка отсутствия эмодзи и графических смайлов в системном промпте."""
    emoji_regex = re.compile(
        r"[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
        r"\U0001F700-\U0001F77F\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF"
        r"\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF"
        r"\u2600-\u26ff\u2700-\u27bf]"
    )
    assert not emoji_regex.search(SYSTEM_EXTRACTOR_PROMPT), "SYSTEM_EXTRACTOR_PROMPT содержит эмодзи"
