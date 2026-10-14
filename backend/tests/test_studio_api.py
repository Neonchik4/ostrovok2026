"""Tests for Studio API endpoints: schema, hotels, and backup."""
import asyncio

from httpx import ASGITransport, AsyncClient

from app.main import app


def test_studio_schema_public():
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/studio/schema")
            assert resp.status_code == 200
            data = resp.json()
            assert "tables" in data
            assert len(data["tables"]) >= 6

    asyncio.run(_run())


def test_studio_hotels_pagination():
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/studio/hotels?offset=0&limit=5")
            assert resp.status_code == 200
            data = resp.json()
            assert "items" in data
            assert "total" in data
            assert len(data["items"]) <= 5

    asyncio.run(_run())
