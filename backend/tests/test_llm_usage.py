import asyncio
import json
import re
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.services import embedding_service, llm_client, slot_extractor
from app.services.llm_usage import (
    LlmCallUsage,
    cost_usd,
    drain_llm_usage,
    record_llm_call,
    start_llm_usage_collection,
    stop_llm_usage_collection,
)


def _usage(prompt=0, candidates=0, thoughts=None, cached=None, total=None):
    return SimpleNamespace(
        prompt_token_count=prompt,
        candidates_token_count=candidates,
        thoughts_token_count=thoughts,
        cached_content_token_count=cached,
        total_token_count=total,
    )


@pytest.fixture
def collector():
    token = start_llm_usage_collection()
    yield
    stop_llm_usage_collection(token)


# ── Цены (официальный прайс Gemini API, Paid Tier Standard) ──────────────────


def test_cost_uses_input_and_output_prices():
    # gemini-3.5-flash-lite: $0.30 / 1M вход, $2.50 / 1M выход
    assert cost_usd("gemini-3.5-flash-lite", input_tokens=1000, cached_tokens=0, output_tokens=500) == pytest.approx(
        1000 * 0.30 / 1e6 + 500 * 2.50 / 1e6
    )


def test_cached_input_is_billed_at_cache_price():
    # gemini-2.5-flash: $0.30 вход, $0.03 кэш, $2.50 выход
    cost = cost_usd("gemini-2.5-flash", input_tokens=1000, cached_tokens=400, output_tokens=0)
    assert cost == pytest.approx(600 * 0.30 / 1e6 + 400 * 0.03 / 1e6)


def test_price_is_taken_only_for_exact_model_from_the_price_list():
    # Похожие имена не угадываем: у preview-версий своей строки в прайсе нет
    assert cost_usd("gemini-2.5-flash-lite-preview-09-2025", input_tokens=10, cached_tokens=0, output_tokens=0) is None
    assert cost_usd("gemini-embedding-2-preview", input_tokens=10, cached_tokens=0, output_tokens=0) is None
    # gemini-3.5-flash устарела: цена — только по фактической модели из ответа (3.6-flash)
    assert cost_usd("gemini-3.5-flash", input_tokens=10, cached_tokens=0, output_tokens=0) is None


def test_price_missing_from_the_price_list_is_not_invented():
    # У эмбеддингов в прайсе только цена входа: выход или кэш посчитать нечем
    assert cost_usd("gemini-embedding-2", input_tokens=1_000_000, cached_tokens=0, output_tokens=0) == pytest.approx(0.20)
    assert cost_usd("gemini-embedding-2", input_tokens=10, cached_tokens=5, output_tokens=0) is None
    assert cost_usd("gemini-embedding-2", input_tokens=10, cached_tokens=0, output_tokens=3) is None


def test_unknown_model_has_no_cost():
    assert cost_usd("some-unknown-model", input_tokens=10, cached_tokens=0, output_tokens=10) is None


# ── Сбор телеметрии ──────────────────────────────────────────────────────────


def test_missing_usage_is_recorded_as_unknown_not_dropped(collector):
    # Ответ пришёл (оплачен), но usage_metadata нет — показываем «не удалось получить»
    record_llm_call(stage="response", model="gemini-3.5-flash-lite", usage=None, duration_ms=700, ttft_ms=300)
    [call] = drain_llm_usage()
    assert call.input_tokens is None
    assert call.output_tokens is None
    assert call.total_tokens is None
    assert call.output_tokens_per_sec is None
    assert call.cost_usd is None
    assert call.ttft_ms == 300


def test_record_is_noop_without_active_collection():
    record_llm_call(stage="response", model="gemini-3.5-flash-lite", usage=_usage(5, 5), duration_ms=10)
    token = start_llm_usage_collection()
    try:
        assert drain_llm_usage() == []
    finally:
        stop_llm_usage_collection(token)


def test_record_builds_call_with_thinking_billed_as_output(collector):
    record_llm_call(
        stage="slots",
        model="gemini-3.5-flash-lite",
        usage=_usage(prompt=1000, candidates=200, thoughts=300, total=1500),
        duration_ms=2000,
    )
    [call] = drain_llm_usage()
    assert isinstance(call, LlmCallUsage)
    assert call.input_tokens == 1000
    assert call.output_tokens == 500
    assert call.thinking_tokens == 300
    assert call.total_tokens == 1500
    assert call.ttft_ms is None
    assert call.streamed is False
    # Скорость — видимые токены ответа за время вызова
    assert call.output_tokens_per_sec == pytest.approx(100.0)
    assert call.cost_usd == pytest.approx(1000 * 0.30 / 1e6 + 500 * 2.50 / 1e6)
    # drain отдаёт только новые вызовы
    assert drain_llm_usage() == []


def test_streamed_speed_excludes_time_to_first_token(collector):
    record_llm_call(
        stage="response",
        model="gemini-3.5-flash-lite",
        usage=_usage(prompt=100, candidates=200),
        duration_ms=1500,
        ttft_ms=500,
    )
    [call] = drain_llm_usage()
    assert call.streamed is True
    assert call.ttft_ms == 500
    assert call.output_tokens_per_sec == pytest.approx(200.0)


def test_gateway_cache_hit_is_not_billed(collector):
    # Ответ из кэша Cloudflare AI Gateway до Google не доходит — оплаты нет
    record_llm_call(
        stage="response",
        model="gemini-3.5-flash-lite",
        usage=_usage(1000, 100),
        duration_ms=50,
        ttft_ms=20,
        gateway_cache_hit=True,
    )
    [call] = drain_llm_usage()
    assert call.gateway_cache_hit is True
    assert call.cost_usd == 0.0
    assert call.total_tokens == 1100


# ── Инструментирование вызовов Gemini ────────────────────────────────────────


class _FakeModels:
    def __init__(self, chunks=None, response=None, count=7):
        self._chunks = chunks or []
        self._response = response
        self._count = count

    async def generate_content_stream(self, **kwargs):
        async def _gen():
            for chunk in self._chunks:
                yield chunk

        return _gen()

    async def generate_content(self, **kwargs):
        return self._response

    async def embed_content(self, **kwargs):
        return SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1, 0.2])], metadata=None)

    async def count_tokens(self, **kwargs):
        return SimpleNamespace(total_tokens=self._count)


def _fake_client(models):
    return SimpleNamespace(aio=SimpleNamespace(models=models))


@pytest.fixture
def online(monkeypatch):
    monkeypatch.setattr(llm_client, "is_offline_mode", lambda: False)
    monkeypatch.setattr(llm_client, "_build_attempts", lambda: [("key-1", "gemini-3.5-flash")])


def test_stream_records_usage_of_the_model_that_actually_answered(monkeypatch, online, collector):
    miss = SimpleNamespace(headers={"cf-aig-cache-status": "MISS"})
    chunks = [
        SimpleNamespace(text="При", usage_metadata=None, model_version=None, sdk_http_response=miss),
        SimpleNamespace(
            text="вет",
            usage_metadata=_usage(40, 2, total=42),
            model_version="gemini-3.6-flash",
            sdk_http_response=miss,
        ),
    ]
    monkeypatch.setattr(llm_client, "_get_client", lambda key: _fake_client(_FakeModels(chunks=chunks)))

    async def _run():
        return [c async for c in llm_client.stream_gemini_content("p", stage="response")]

    assert "".join(asyncio.run(_run())) == "Привет"
    [call] = drain_llm_usage()
    assert call.stage == "response"
    # gemini-3.5-flash устарела и маршрутизируется на 3.6 — считаем по фактической модели
    assert call.model == "gemini-3.6-flash"
    assert call.input_tokens == 40
    assert call.output_tokens == 2
    assert call.ttft_ms is not None
    assert call.cost_usd == pytest.approx(40 * 0.75 / 1e6 + 2 * 3.75 / 1e6)
    assert call.gateway_cache_hit is False


def test_non_stream_call_records_usage(monkeypatch, online, collector):
    response = SimpleNamespace(
        text="ok",
        usage_metadata=_usage(10, 3, total=13),
        model_version=None,
        sdk_http_response=SimpleNamespace(headers={"CF-AIG-Cache-Status": "HIT"}),
    )
    monkeypatch.setattr(llm_client, "_get_client", lambda key: _fake_client(_FakeModels(response=response)))

    assert asyncio.run(llm_client.call_gemini_content("p", stage="action")) == "ok"
    [call] = drain_llm_usage()
    assert call.stage == "action"
    # model_version не пришёл — берём запрошенную модель
    assert call.model == "gemini-3.5-flash"
    assert call.total_tokens == 13
    assert call.gateway_cache_hit is True
    assert call.cost_usd == 0.0


def test_slot_extractor_records_billed_call_even_if_json_is_broken(monkeypatch, collector):
    response = SimpleNamespace(text="не json", usage_metadata=_usage(120, 8, total=128), model_version="gemini-3.5-flash-lite")
    monkeypatch.setattr(llm_client, "get_gemini_client", lambda key: _fake_client(_FakeModels(response=response)))

    with pytest.raises(json.JSONDecodeError):
        asyncio.run(slot_extractor._call_gemini_extractor("Сочи у моря", "gemini-3.5-flash-lite", "key-1"))
    [call] = drain_llm_usage()
    assert call.stage == "slots"
    assert call.input_tokens == 120


def test_embedding_without_token_count_is_recorded_as_unknown(monkeypatch, collector):
    class _NoCount(_FakeModels):
        async def count_tokens(self, **kwargs):
            raise RuntimeError("countTokens недоступен")

    monkeypatch.setattr(embedding_service, "is_offline_mode", lambda: False)
    monkeypatch.setattr(embedding_service, "_get_api_keys", lambda: ["key-1"])
    monkeypatch.setattr(embedding_service, "_get_client", lambda key: _fake_client(_NoCount()))
    embedding_service._query_cache.clear()

    asyncio.run(embedding_service.embed_text_gemini("отель в горах"))
    [call] = drain_llm_usage()
    assert call.stage == "embedding"
    assert call.input_tokens is None
    assert call.cost_usd is None


def test_usd_rub_rate_is_none_when_not_configured(monkeypatch):
    from app.config import _parse_usd_rub_rate

    monkeypatch.delenv("USD_RUB_RATE", raising=False)
    assert _parse_usd_rub_rate() is None
    monkeypatch.setenv("USD_RUB_RATE", "не число")
    assert _parse_usd_rub_rate() is None
    monkeypatch.setenv("USD_RUB_RATE", "80.5307")
    assert _parse_usd_rub_rate() == 80.5307


def test_embedding_records_tokens_from_count_tokens(monkeypatch, collector):
    monkeypatch.setattr(embedding_service, "is_offline_mode", lambda: False)
    monkeypatch.setattr(embedding_service, "_get_api_keys", lambda: ["key-1"])
    monkeypatch.setattr(embedding_service, "_get_client", lambda key: _fake_client(_FakeModels(count=9)))
    embedding_service._query_cache.clear()

    assert asyncio.run(embedding_service.embed_text_gemini("отель у моря")) == [0.1, 0.2]
    [call] = drain_llm_usage()
    assert call.stage == "embedding"
    assert call.model == "gemini-embedding-2-preview"
    assert call.input_tokens == 9
    assert call.output_tokens == 0
    # gemini-embedding-2-preview в прайсе отдельной строкой нет — цену не выдумываем
    assert call.cost_usd is None


# ── SSE-контракт ─────────────────────────────────────────────────────────────


def _events(body: str) -> list[tuple[str, dict]]:
    return [
        (m.group(1), json.loads(m.group(2)))
        for m in re.finditer(r"event: (\w+)\ndata: (.*)\n\n", body)
    ]


def test_stream_emits_llm_usage_before_done(monkeypatch):
    from app.graph import workflow

    monkeypatch.setattr(settings, "TRAVELPAYOUTS_TOKEN", "")
    monkeypatch.setattr(settings, "USD_RUB_RATE", 80.5307)

    async def _fake_response(*args, **kwargs):
        record_llm_call(
            stage="response",
            model="gemini-3.5-flash-lite",
            usage=_usage(300, 50, total=350),
            duration_ms=900,
            ttft_ms=400,
        )
        yield "Готово."

    async def _offline_slots(message):
        return slot_extractor.mock_extract_slots(message)

    # Без сетевых вызовов: слоты — детерминированный экстрактор, ответ — фейковый стрим
    monkeypatch.setattr(workflow, "extract_slots_cascade", _offline_slots)
    monkeypatch.setattr(workflow, "generate_concierge_response_stream", _fake_response)

    async def _run():
        async with AsyncClient(transport=ASGITransport(app=workflow_app()), base_url="http://test") as ac:
            resp = await ac.post("/api/chat/stream", json={"message": "Отель в Сочи у моря"})
            return resp.text

    events = _events(asyncio.run(_run()))
    names = [name for name, _ in events]
    assert names[-1] == "done"
    usage_events = [data for name, data in events if name == "llm_usage"]
    assert usage_events, "ожидается хотя бы одно событие llm_usage"
    calls = [c for data in usage_events for c in data["calls"]]
    response_calls = [c for c in calls if c["stage"] == "response"]
    assert response_calls == [
        {
            "stage": "response",
            "model": "gemini-3.5-flash-lite",
            "input_tokens": 300,
            "cached_tokens": 0,
            "output_tokens": 50,
            "thinking_tokens": 0,
            "total_tokens": 350,
            "ttft_ms": 400,
            "duration_ms": 900,
            "output_tokens_per_sec": pytest.approx(50 / 0.5),
            "streamed": True,
            "gateway_cache_hit": False,
            "cost_usd": pytest.approx(300 * 0.30 / 1e6 + 50 * 2.50 / 1e6),
        }
    ]
    assert all(data["usd_rub_rate"] == 80.5307 for data in usage_events)
    assert names.index("llm_usage") < names.index("done")


def workflow_app():
    from app.main import app

    return app
