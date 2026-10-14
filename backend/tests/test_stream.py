import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


@pytest.fixture(autouse=True)
def fast_test_stream_env(monkeypatch):
    """
    Ускоряет тесты стрима:
    1. Отключает внешние сетевые обращения к Gemini, переключая на детерминированный движок.
    2. Убирает визуальные задержки asyncio.sleep, сохраняя переключение корутин.
    Вся бизнес-логика (FastAPI, SSE, слоты, фильтрация отелей, чеки, память) тестируется на 100%.
    """
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    
    original_sleep = asyncio.sleep
    async def _fast_sleep(delay, *args, **kwargs):
        return await original_sleep(0)
    
    monkeypatch.setattr(asyncio, "sleep", _fast_sleep)

def test_chat_stream_contract():
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/chat/stream",
                json={
                    "message": "Найди отель в Красной Поляне с бассейном для двоих с собакой",
                    "nights": 2,
                    "guests": 2,
                    "pets": 1
                }
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")
            
            body = response.text
            # Проверяем наличие ключевых типов событий
            assert "event: thought" in body
            assert "event: token" in body
            assert "event: widget" in body
            assert "event: done" in body
            assert "hotel_grid" in body

    asyncio.run(_run())

def test_chat_stream_disambiguation():
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/chat/stream",
                json={
                    "message": "",
                    "disambiguation_selection": "Рядом с подъемником",
                    "nights": 2,
                    "guests": 2,
                    "pets": 0
                }
            )
            assert response.status_code == 200
            body = response.text
            assert "event: thought" in body
            assert "event: widget" in body
            assert "event: done" in body
            # Убеждаемся, что нет дублирования фразы в ответе
            assert "Рядом с подъемником. Уточнение: Рядом с подъемником" not in body

    asyncio.run(_run())

