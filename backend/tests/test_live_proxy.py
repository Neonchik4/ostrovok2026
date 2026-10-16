import pytest
from fastapi.testclient import TestClient
from httpx import Headers

from app.main import app
from app.services.live.action_service import LiveActionService
from app.services.live.proxy_service import LiveProxyService


@pytest.fixture
def client():
    return TestClient(app)


def test_sanitize_headers():
    svc = LiveProxyService()
    raw_headers = Headers({
        "content-type": "text/html",
        "content-security-policy": "default-src 'self'",
        "x-frame-options": "SAMEORIGIN",
        "strict-transport-security": "max-age=31536000",
        "custom-header": "test-value"
    })
    cleaned = svc.sanitize_headers(raw_headers)

    assert "content-security-policy" not in cleaned
    assert "x-frame-options" not in cleaned
    assert "strict-transport-security" not in cleaned
    assert cleaned.get("custom-header") == "test-value"
    assert cleaned.get("access-control-allow-origin") == "*"


def test_inject_copilot_runtime():
    svc = LiveProxyService()
    html = "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Content</h1></body></html>"
    modified = svc.inject_copilot_runtime(html)

    assert '<base href="https://ostrovok.ru/">' in modified
    assert '<script src="/live-agent/muse-runtime.js" defer></script>' in modified
    assert 'id="ostrovok-copilot-container"' in modified


def test_live_action_clean_emoji():
    svc = LiveActionService()
    text_with_emoji = "Супер отель 🔥 бронируем! 😊 До подъемника 200м 👍"
    cleaned = svc._clean_emoji(text_with_emoji)
    assert "🔥" not in cleaned
    assert "😊" not in cleaned
    assert "👍" not in cleaned
    assert "Супер отель" in cleaned


def test_live_action_fallback_personas():
    svc = LiveActionService()

    # Bro persona
    bro_res = svc._fallback_action("хочу в Сочи с бассейном", persona="bro")
    assert bro_res.persona == "bro"
    assert len(bro_res.steps) > 0
    assert any(s.action == "set_destination" and "Сочи" in s.value for s in bro_res.steps)

    # Assistant persona
    asst_res = svc._fallback_action("командировка в Москву", persona="assistant")
    assert asst_res.persona == "assistant"
    assert "документ" in asst_res.speech.lower() or "параметр" in asst_res.speech.lower()

    # Concierge persona
    conc_res = svc._fallback_action("хочу шикануть в Питере", persona="concierge")
    assert conc_res.persona == "concierge"
    assert any("Питер" in s.value or "Петербург" in s.value for s in conc_res.steps if s.action == "set_destination")


def test_live_health(client):
    resp = client.get("/api/live/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["module"] == "live-copilot-agent"


def test_live_act_endpoint(client):
    payload = {
        "query": "найди лучший отель с бассейном в Сочи",
        "persona": "bro"
    }
    resp = client.post("/api/live/act", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "persona" in data
    assert "speech" in data
    assert "steps" in data
    assert len(data["steps"]) >= 2
