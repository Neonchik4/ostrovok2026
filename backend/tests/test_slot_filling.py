"""
Тесты проактивного slot-filling и сбора города отправления (Issue #40).

Гарантии:
- При ясной цели поездки, но неизвестном origin_city агент задает ровно один
  проактивный вопрос про город выезда с ценностью (поезда/рейсы + трансфер).
- В widget приходят кликабельные чипсы ["Из Москвы", "Из Санкт-Петербурга", "Другой город"].
- Ответ по чипсу («Из Москвы») мержится в session_memory: на следующем ходу
  агент знает город отправления, подтягивает логистику и больше не спрашивает.
- Если origin_city известен или цель поездки неясна — флаг не выставляется.
"""

import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.schemas.chat import ExtractedSlots
from app.services.session_memory import session_memory
from app.services.slot_extractor import ORIGIN_CLARIFICATION_CHIPS, flag_missing_origin_slots


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
def clean_session_memory():
    session_memory.clear()
    yield
    session_memory.clear()


class TestOriginFlagDetection:
    def test_flag_set_when_destination_known_and_origin_missing(self):
        slots = ExtractedSlots(city="Сочи")
        flagged = flag_missing_origin_slots(slots)
        assert flagged.needs_origin_clarification is True

    def test_flag_set_for_thematic_destination(self):
        slots = ExtractedSlots(thematic_category="sea", thematic_title="К морю", candidate_cities=["Сочи"])
        assert flag_missing_origin_slots(slots).needs_origin_clarification is True

    def test_flag_not_set_when_origin_known(self):
        slots = ExtractedSlots(city="Сочи", origin_city="Москва")
        assert flag_missing_origin_slots(slots).needs_origin_clarification is False

    def test_flag_not_set_when_destination_unknown(self):
        slots = ExtractedSlots()
        assert flag_missing_origin_slots(slots).needs_origin_clarification is False


class TestProactiveOriginQuestion:
    def test_full_cycle_asks_origin_city_with_value_proposition(self):
        """Первый запрос без города выезда: проактивный вопрос + чипсы городов."""

        async def _run():
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/api/chat/stream",
                    json={"message": "Найди отель в Сочи на 3 дня до 20000", "conversation_id": "slot_fill_1"},
                )
                assert response.status_code == 200

                events = parse_sse_events(response.text)
                full_text = join_tokens(events)

                # Проактивный вопрос про город выезда присутствует в ответе
                assert "из какого города вы выезжаете" in full_text.lower()
                assert "трансфер" in full_text.lower()

                # Чипсы быстрых ответов подменены на города отправления
                widgets = [p for t, p in events if t == "widget"]
                assert widgets
                chips = widgets[0]["disambiguation_chips"]
                assert chips == ORIGIN_CLARIFICATION_CHIPS
                assert "Из Москвы" in chips and "Другой город" in chips

                # Стрим завершен успешно
                assert any(t == "done" and p.get("status") == "ok" for t, p in events)

        asyncio.run(_run())

    def test_multi_turn_chip_answer_merges_origin_city(self):
        """
        Мультитерн: ответ по чипсу «Из Москвы» мержится в сессию, агент
        перестает спрашивать город и подтягивает логистику с реальным origin.
        """

        async def _run():
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                # Ход 1: запрос без города отправления
                first = await ac.post(
                    "/api/chat/stream",
                    json={"message": "Отель в Сочи со спа на 3 ночи", "conversation_id": "slot_fill_2"},
                )
                assert first.status_code == 200
                saved = session_memory.get_slots("slot_fill_2")
                assert saved.city == "Сочи"
                assert saved.origin_city is None
                assert saved.needs_origin_clarification is True

                # Ход 2: клик по чипсу «Из Москвы»
                second = await ac.post(
                    "/api/chat/stream",
                    json={
                        "message": "",
                        "disambiguation_selection": "Из Москвы",
                        "conversation_id": "slot_fill_2",
                    },
                )
                assert second.status_code == 200

                merged = session_memory.get_slots("slot_fill_2")
                assert merged.origin_city == "Москва"
                assert merged.city == "Сочи"
                assert merged.needs_origin_clarification is False

                second_events = parse_sse_events(second.text)
                second_text = join_tokens(second_events)

                # Агент больше не спрашивает город выезда
                assert "из какого города вы выезжаете" not in second_text.lower()

                # Логистика рассчитана от реального города отправления
                transport_thoughts = [
                    p for t, p in second_events
                    if t == "thought" and p.get("step") == "transport_search"
                ]
                assert transport_thoughts
                assert "Москва" in transport_thoughts[0]["text"]

                # Чипсы вернулись к обычным уточнениям, а не к городам отправления
                widgets = [p for t, p in second_events if t == "widget"]
                assert widgets
                assert widgets[0]["disambiguation_chips"] != ORIGIN_CLARIFICATION_CHIPS

        asyncio.run(_run())

    def test_origin_in_first_message_skips_clarification(self):
        """Если город выезда указан сразу — вопрос не задается, чипсы обычные."""

        async def _run():
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.post(
                    "/api/chat/stream",
                    json={
                        "message": "Из Казани в Сочи на 3 ночи, отель с бассейном",
                        "conversation_id": "slot_fill_3",
                    },
                )
                assert response.status_code == 200

                events = parse_sse_events(response.text)
                full_text = join_tokens(events)
                assert "из какого города вы выезжаете" not in full_text.lower()

                widgets = [p for t, p in events if t == "widget"]
                assert widgets
                assert widgets[0]["disambiguation_chips"] != ORIGIN_CLARIFICATION_CHIPS

        asyncio.run(_run())
