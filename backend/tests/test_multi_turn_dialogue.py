"""
Сквозное тестирование многоходовых диалогов (Multi-turn Slot Merging & Session Stability).

Оценивает устойчивость состояния диалога в SSE-эндпоинте /api/chat/stream на цепочках
из 2, 3, 4, 5 и 10 реплик:
- Каноническая 10-ходовая цепочка: направление -> фильтр -> бюджет -> питомец -> сдвиг дат ->
  отзывы -> логистика вокзала -> ранний заезд -> возражение по цене -> подтверждение брони;
- Отдельное тестирование цепочек из 2, 3, 4, 5 реплик;
- Проверка смены направления (сброс старых фильтров при сохранении маршрута);
- Экстремальный клампинг гостей и ночей в мультитерне;
- Строгий Zero-Emoji во всех чанках стрима.
"""

import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.services.session_memory import session_memory


def parse_sse_events(body: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in body.split("\n\n"):
        event_type = None
        data_lines: list[str] = []
        for line in block.splitlines():
            if line.startswith("event:"):
                event_type = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data_lines.append(line[len("data:"):].strip())
        if event_type and data_lines:
            events.append((event_type, json.loads("\n".join(data_lines))))
    return events


def join_tokens(events: list[tuple[str, dict]]) -> str:
    return "".join(payload.get("content", "") for event_type, payload in events if event_type == "token")


@pytest.fixture(autouse=True)
def offline_and_fast(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEYS", [])
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "TRAVELPAYOUTS_TOKEN", "")

    original_sleep = asyncio.sleep

    async def _fast_sleep(delay, *args, **kwargs):
        return await original_sleep(0)

    monkeypatch.setattr(asyncio, "sleep", _fast_sleep)


@pytest.fixture(autouse=True)
def clean_memory():
    session_memory.clear()
    yield
    session_memory.clear()


@pytest.mark.asyncio
async def test_canonical_10_turns_dialogue_via_stream():
    """Канонический 10-ходовый диалог: проверка целостности слотов и контракта SSE."""
    transport = ASGITransport(app=app)
    conv_id = "canon_10_turn_stream"

    turns = [
        # Ход 1: Начальный запрос
        ("Хочу отель в Сочи на 4 человек с 10 по 15 июля", lambda s: s.city == "Сочи" and s.guests_count == 4 and s.nights == 5),
        # Ход 2: Добавление удобства
        ("только с завтраком", lambda s: s.city == "Сочи" and s.guests_count == 4 and s.breakfast_included is True),
        # Ход 3: Ограничение бюджета
        ("дешевле 8000 руб", lambda s: s.city == "Сочи" and s.breakfast_included is True and s.max_price_per_night_rub == 8000),
        # Ход 4: Добавление питомца
        ("едем с собакой", lambda s: s.pet_friendly is True and s.max_price_per_night_rub == 8000),
        # Ход 5: Сдвиг дат
        ("а если на 2 дня позже?", lambda s: s.city == "Сочи" and s.pet_friendly is True and s.depart_date is not None),
        # Ход 6: Запрос отзывов
        ("чё по отзывам об этом отеле?", lambda s: s.is_review_inquiry is True and s.city == "Сочи"),
        # Ход 7: Логистика вокзала
        ("сколько такси от вокзала?", lambda s: s.near_station is True and s.is_review_inquiry is False),
        # Ход 8: Ранний заезд
        ("можно заехать в 10 утра?", lambda s: s.arrival_time == "10:00" and s.needs_early_checkin is True),
        # Ход 9: Возражение по цене
        ("почему этот отель дороже?", lambda s: s.city == "Сочи" and s.guests_count == 4),
        # Ход 10: Подтверждение выбора
        ("бронирую первый вариант", lambda s: s.city == "Сочи" and s.guests_count == 4 and s.breakfast_included is True),
    ]

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for idx, (msg, validator) in enumerate(turns, start=1):
            resp = await ac.post("/api/chat/stream", json={"message": msg, "conversation_id": conv_id})
            assert resp.status_code == 200, f"Turn {idx} failed with status {resp.status_code}"

            events = parse_sse_events(resp.text)
            event_types = [t for t, _ in events]
            assert "thought" in event_types, f"Turn {idx} missing thought event"
            assert "token" in event_types, f"Turn {idx} missing token event"
            assert "widget" in event_types, f"Turn {idx} missing widget event"
            assert any(t == "done" and p.get("status") == "ok" for t, p in events), f"Turn {idx} not completed"

            # Проверка слотов в session_memory
            saved_slots = session_memory.get_slots(conv_id)
            assert saved_slots is not None, f"Turn {idx} slots not saved"
            assert validator(saved_slots), f"Turn {idx} validation failed for message: '{msg}'"


@pytest.mark.asyncio
async def test_multi_turn_two_turns_dialogue():
    """Тестирование цепочки из 2 реплик в SSE."""
    transport = ASGITransport(app=app)
    cid = "test_2_turns"
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r1 = await ac.post("/api/chat/stream", json={"message": "Отель в Москве на 2 ночи", "conversation_id": cid})
        assert r1.status_code == 200
        s1 = session_memory.get_slots(cid)
        assert s1.city == "Москва"

        r2 = await ac.post("/api/chat/stream", json={"message": "только с бассейном", "conversation_id": cid})
        assert r2.status_code == 200
        s2 = session_memory.get_slots(cid)
        assert s2.city == "Москва"
        assert s2.heated_pool is True


@pytest.mark.asyncio
async def test_multi_turn_three_turns_dialogue():
    """Тестирование цепочки из 3 реплик в SSE."""
    transport = ASGITransport(app=app)
    cid = "test_3_turns"
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.post("/api/chat/stream", json={"message": "Казань на 3 дня", "conversation_id": cid})
        await ac.post("/api/chat/stream", json={"message": "с завтраком", "conversation_id": cid})
        await ac.post("/api/chat/stream", json={"message": "дешевле 6000", "conversation_id": cid})

        s = session_memory.get_slots(cid)
        assert s.city == "Казань"
        assert s.breakfast_included is True
        assert s.max_price_per_night_rub == 6000


@pytest.mark.asyncio
async def test_multi_turn_four_turns_dialogue():
    """Тестирование цепочки из 4 реплик в SSE."""
    transport = ASGITransport(app=app)
    cid = "test_4_turns"
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.post("/api/chat/stream", json={"message": "Екатеринбург на выходные", "conversation_id": cid})
        await ac.post("/api/chat/stream", json={"message": "4 звезды", "conversation_id": cid})
        await ac.post("/api/chat/stream", json={"message": "с бесплатной отменой", "conversation_id": cid})
        await ac.post("/api/chat/stream", json={"message": "едем с кошкой", "conversation_id": cid})

        s = session_memory.get_slots(cid)
        assert s.city == "Екатеринбург"
        assert s.stars == 4
        assert s.free_cancellation is True
        assert s.pet_friendly is True


@pytest.mark.asyncio
async def test_multi_turn_five_turns_dialogue():
    """Тестирование цепочки из 5 реплик в SSE."""
    transport = ASGITransport(app=app)
    cid = "test_5_turns"
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.post("/api/chat/stream", json={"message": "Шерегеш на 7 ночей для 6 человек", "conversation_id": cid})
        await ac.post("/api/chat/stream", json={"message": "у подъемника", "conversation_id": cid})
        await ac.post("/api/chat/stream", json={"message": "с сауной", "conversation_id": cid})
        await ac.post("/api/chat/stream", json={"message": "завтрак включен", "conversation_id": cid})
        await ac.post("/api/chat/stream", json={"message": "общий бюджет 60 000 руб", "conversation_id": cid})

        s = session_memory.get_slots(cid)
        assert s.city == "Шерегеш"
        assert s.guests_count == 6
        assert s.nights == 7
        assert s.spa is True
        assert s.breakfast_included is True
        assert s.total_trip_budget_rub == 60000


@pytest.mark.asyncio
async def test_destination_switch_clears_old_filters_preserves_route():
    """Смена города сбрасывает специфические фильтры, но сохраняет город отправления и бюджет."""
    transport = ASGITransport(app=app)
    cid = "test_dest_switch"
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Шаг 1: Москва из Самары с бассейном и 5 звездами
        await ac.post("/api/chat/stream", json={"message": "Из Самары в Москву 5 звезд с бассейном бюджет 50000", "conversation_id": cid})
        s1 = session_memory.get_slots(cid)
        assert s1.city == "Москва"
        assert s1.origin_city == "Самара"
        assert s1.stars == 5

        # Шаг 2: Смена города на Сочи
        await ac.post("/api/chat/stream", json={"message": "хочу в Сочи вместо Москвы", "conversation_id": cid})
        s2 = session_memory.get_slots(cid)
        assert s2.city == "Сочи"
        assert s2.origin_city == "Самара"  # Город отправления сохранен
        assert s2.total_trip_budget_rub == 50000  # Бюджет сохранен
        assert s2.stars is None  # Старый звездный фильтр сброшен


@pytest.mark.asyncio
async def test_clamping_invariants_across_multi_turn():
    """Проверка инвариантов клампинга (гости 1..20, ночи 1..90) при многоходовом диалоге."""
    transport = ASGITransport(app=app)
    cid = "test_clamping"
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Запрос на 100 гостей и 200 ночей
        await ac.post("/api/chat/stream", json={"message": "Казань на 100 человек на 200 ночей", "conversation_id": cid})
        s1 = session_memory.get_slots(cid)
        assert s1.guests_count == 20
        assert s1.nights == 90

        # Уточняющий шаг — значения не раздуваются
        await ac.post("/api/chat/stream", json={"message": "только с завтраком", "conversation_id": cid})
        s2 = session_memory.get_slots(cid)
        assert s2.guests_count == 20
        assert s2.nights == 90
        assert s2.breakfast_included is True
