import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

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
