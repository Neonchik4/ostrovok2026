"""Tests for the instant /health and /api/health endpoints."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data


def test_api_health_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
