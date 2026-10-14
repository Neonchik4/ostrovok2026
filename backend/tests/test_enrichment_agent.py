import pytest
from unittest.mock import patch, AsyncMock
from backend.app.services.enrichment_agent import run_enrichment_task


@pytest.mark.asyncio
async def test_enrichment_agent_handles_worker_offline_gracefully():
    """Ensure enrichment agent falls back cleanly when worker is not reachable."""
    steps = []
    async for event in run_enrichment_task(prompt="добавь спа и бассейн", city="Сочи"):
        steps.append(event)

    step_names = [s["step"] for s in steps]
    assert "plan" in step_names
    assert "retrieval" in step_names
    assert "synthesis" in step_names
    assert "proposal_ready" in step_names
    assert "done" in step_names

    # Check that fallback message does not leak raw getaddrinfo or errno
    fallback_events = [s for s in steps if s.get("step") == "worker_fallback"]
    if fallback_events:
        fallback_text = fallback_events[0].get("text", "")
        assert "11001" not in fallback_text
        assert "getaddrinfo" not in fallback_text
        assert "Traceback" not in fallback_text


@pytest.mark.asyncio
async def test_enrichment_agent_worker_success():
    """Ensure enrichment agent consumes worker response when reachable."""
    from unittest.mock import MagicMock
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "success": True,
        "count": 2,
        "hotels": [
            {"id": "sochi_1", "name": "Отель Сочи 1"},
            {"id": "sochi_2", "name": "Отель Сочи 2"},
        ],
    }

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        steps = []
        async for event in run_enrichment_task(prompt="проверь бассейн", city="Сочи"):
            steps.append(event)

        step_names = [s["step"] for s in steps]
        assert "worker_data" in step_names
        worker_ev = next(s for s in steps if s["step"] == "worker_data")
        assert "2 объектов" in worker_ev["text"]
