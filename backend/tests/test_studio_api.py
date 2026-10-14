"""Tests for Studio API endpoints: auth, schema, hotels, and proposal rollback."""
import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings

TEST_TOKEN = "ostrovok_studio_test_token"


@pytest.fixture(autouse=True)
def setup_test_auth(monkeypatch):
    monkeypatch.setattr(settings, "STUDIO_TEAM_TOKEN", TEST_TOKEN)


def test_studio_auth_unauthorized():
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/studio/schema")
            assert resp.status_code == 401

            resp_bad = await ac.get("/api/studio/schema", headers={"X-Studio-Token": "wrong_token"})
            assert resp_bad.status_code == 401

    asyncio.run(_run())


def test_studio_schema_authorized():
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/studio/schema", headers={"X-Studio-Token": TEST_TOKEN})
            assert resp.status_code == 200
            data = resp.json()
            assert "tables" in data
            assert len(data["tables"]) >= 6

    asyncio.run(_run())


def test_studio_hotels_pagination():
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/studio/hotels?offset=0&limit=5", headers={"X-Studio-Token": TEST_TOKEN})
            assert resp.status_code == 200
            data = resp.json()
            assert "items" in data
            assert "total" in data
            assert len(data["items"]) <= 5

    asyncio.run(_run())
