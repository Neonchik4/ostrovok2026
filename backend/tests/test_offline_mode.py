"""
Интеграционные и юнит-тесты Zero-Config Offline Mode (Issue #46).

Гарантии:
- Запуск бэкенда с пустым .env (GEMINI_API_KEYS=[]) поднимает полностью
  работоспособный сервис: полный цикл чата от thought до done без ошибок.
- В SSE-потоке присутствует статусная плашка автономного режима (event: mode).
- Авторизационные отказы внешнего API переводят процесс в автономный режим
  и исключают невалидные ключи из каскада без повторных сетевых вызовов.
"""

import asyncio
import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.services import offline_mode
from app.services.llm_client import call_gemini_content


@pytest.fixture(autouse=True)
def clean_offline_state():
    """Изолирует process-local состояние автономного режима между тестами."""
    offline_mode.reset_offline_state()
    yield
    offline_mode.reset_offline_state()


@pytest.fixture(autouse=True)
def no_api_keys(monkeypatch):
    """Полностью отключает внешние API: детерминированный локальный движок."""
    monkeypatch.setattr(settings, "GEMINI_API_KEYS", [])
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "TRAVELPAYOUTS_TOKEN", "")

    original_sleep = asyncio.sleep

    async def _fast_sleep(delay, *args, **kwargs):
        return await original_sleep(0)

    monkeypatch.setattr(asyncio, "sleep", _fast_sleep)


def test_full_chat_cycle_without_api_keys():
    """
    Интеграционный тест DoD: полный цикл чата при GEMINI_API_KEY=None.
    Сервис не падает, отдает mode-плашку, полный пайплайн thought -> done.
    """

    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/chat/stream",
                json={
                    "message": "Найди отель в Сочи на 3 ночи для двоих с завтраком",
                    "nights": 3,
                    "guests": 2,
                    "pets": 0,
                },
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")

            body = response.text
            # Статусная плашка автономного режима в событиях SSE
            assert "event: mode" in body
            assert offline_mode.OFFLINE_MODE_MESSAGE in body
            assert '"offline": true' in body

            # Полный контракт пайплайна сохранен
            assert "event: thought" in body
            assert "event: token" in body
            assert "event: widget" in body
            assert "event: done" in body
            assert "hotel_grid" in body
            assert '"status": "ok"' in body
            # Ошибки обработки отсутствуют
            assert "event: done" in body and '"status": "error"' not in body

    asyncio.run(_run())


def test_first_stream_event_is_still_reasoning_thought():
    """
    Контракт мгновенного отклика сохраняется: первое событие стрима —
    thought (reasoning), mode-плашка следует сразу за ним.
    """

    async def _run():
        from app.graph.workflow import run_agent_workflow
        from app.schemas.chat import ChatStreamRequest

        req = ChatStreamRequest(message="Отель в Сочи", conversation_id="offline_first_event")
        events = []
        async for event in run_agent_workflow(req):
            events.append(event)
            if len(events) >= 2:
                break

        assert "event: thought" in events[0]
        assert "reasoning" in events[0]
        assert "event: mode" in events[1]
        assert offline_mode.OFFLINE_MODE_MESSAGE in events[1]

    asyncio.run(_run())


def test_is_auth_error_detection():
    """Детектор авторизационных отказов не путает их с таймаутами и 429."""
    assert offline_mode.is_auth_error("API key not valid. Please pass a valid API key.")
    assert offline_mode.is_auth_error("403 PERMISSION_DENIED")
    assert offline_mode.is_auth_error("API_KEY_INVALID")
    assert not offline_mode.is_auth_error("Request timed out after 6 seconds")
    assert not offline_mode.is_auth_error("429 RESOURCE_EXHAUSTED")
    assert not offline_mode.is_auth_error("")


def test_offline_mode_without_keys(monkeypatch):
    """Нет ключей — автономный режим активен с самого старта."""
    monkeypatch.setattr(settings, "GEMINI_API_KEYS", [])
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    assert offline_mode.is_offline_mode()


def test_dead_keys_activate_offline_mode(monkeypatch):
    """Все ключи отклонены внешним API — каскад переходит в автономный режим."""
    monkeypatch.setattr(settings, "GEMINI_API_KEYS", ["bad-key-1", "bad-key-2"])
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "bad-key-1")

    assert not offline_mode.is_offline_mode()

    offline_mode.register_dead_key("bad-key-1")
    assert not offline_mode.is_offline_mode()

    offline_mode.register_dead_key("bad-key-2")
    assert offline_mode.all_configured_keys_dead()
    assert offline_mode.is_offline_mode()


def test_filter_live_keys_excludes_dead(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEYS", ["alive", "dead"])
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "alive")
    offline_mode.register_dead_key("dead")
    assert offline_mode.filter_live_keys(["alive", "dead"]) == ["alive"]


def test_call_gemini_content_returns_none_instantly_offline():
    """В автономном режиме сетевые вызовы не выполняются: мгновенный None."""

    async def _run():
        t0 = time.time()
        result = await call_gemini_content("тестовый промпт")
        elapsed = time.time() - t0
        assert result is None
        assert elapsed < 0.1, "Офлайн-режим не должен выполнять сетевых вызовов"

    asyncio.run(_run())


def test_auth_error_latches_offline_mode(monkeypatch):
    """
    Невалидный ключ в каскаде: после авторизационного отказа всех ключей
    процесс фиксирует автономный режим для последующих запросов.
    """
    monkeypatch.setattr(settings, "GEMINI_API_KEYS", ["invalid-key"])
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "invalid-key")

    import app.services.llm_client as llm_client

    class _FakeModels:
        @staticmethod
        async def generate_content(*args, **kwargs):
            raise RuntimeError("API key not valid. Please pass a valid API key.")

    class _FakeAio:
        models = _FakeModels()

    class _FakeClient:
        aio = _FakeAio()

    monkeypatch.setattr(llm_client, "_get_client", lambda key: _FakeClient())

    async def _run():
        result = await llm_client.call_gemini_content("привет")
        assert result is None

    asyncio.run(_run())

    assert offline_mode.all_configured_keys_dead()
    assert offline_mode.is_offline_mode()
    assert offline_mode.get_offline_reason() is not None
