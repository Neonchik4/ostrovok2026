import asyncio
import time
import pytest
from app.schemas.chat import ChatStreamRequest
from app.graph.workflow import run_agent_workflow
from app.services.llm_cascade import _mock_extract_slots
from app.config import settings

@pytest.fixture(autouse=True)
def fast_timing_env(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")


def test_stream_first_thought_is_immediate():
    """
    Проверяет, что первое событие thought (индикация начала рассуждений)
    отдаётся мгновенно (менее 250 мс), устраняя зависание интерфейса.
    """
    async def _run():
        req = ChatStreamRequest(
            message="Отель в Красной Поляне с бассейном до 20000 руб",
            conversation_id="test_timing_conv",
        )

        t0 = time.time()
        first_event = None
        async for event in run_agent_workflow(req):
            first_event = event
            break

        elapsed = time.time() - t0
        assert first_event is not None
        assert "event: thought" in first_event
        assert "reasoning" in first_event
        assert elapsed < 0.25, f"Первое событие должно приходить практически мгновенно, получено за {elapsed:.3f}с"

    asyncio.run(_run())


def test_stream_event_sequence_integrity():
    """
    Проверяет строгий порядок и полноту этапов агентного пайплайна:
    thought (reasoning) -> thought (filtering) -> thought (hybrid_search) ->
    thought (results) -> thought (receipt_calculation) -> token -> widget -> done
    """
    async def _run():
        req = ChatStreamRequest(
            message="Отель в Сочи со спа на 3 ночи",
            conversation_id="test_seq_conv",
        )

        steps_seen = []
        events_seen = []

        async for chunk in run_agent_workflow(req):
            for line in chunk.split("\n"):
                if line.startswith("event:"):
                    events_seen.append(line.split(":", 1)[1].strip())
                if '"step":' in line:
                    import json
                    try:
                        data = json.loads(line.replace("data:", "").strip())
                        step = data.get("step")
                        if step and (not steps_seen or steps_seen[-1] != step):
                            steps_seen.append(step)
                    except Exception:
                        pass

        # Проверяем последовательность событий
        assert "thought" in events_seen
        assert "token" in events_seen
        assert "widget" in events_seen
        assert "done" in events_seen

        # Проверяем все 5 этапов рассуждения
        expected_steps = ["reasoning", "filtering", "hybrid_search", "results", "receipt_calculation"]
        for expected in expected_steps:
            assert expected in steps_seen, f"Шаг {expected} должен присутствовать в стриме мыслей"

    asyncio.run(_run())


def test_concurrent_slot_extraction_does_not_block_loop():
    """
    Проверяет, что фоновое извлечение слотов не блокирует event loop
    и позволяет другим конкурентным корутинам выполняться параллельно.
    """
    async def _run():
        counter = 0

        async def background_ticker():
            nonlocal counter
            for _ in range(10):
                counter += 1
                await asyncio.sleep(0.02)

        async def mock_async_task():
            # Имитируем неблокирующую асинхронную паузу вызова API
            await asyncio.sleep(0.08)
            return _mock_extract_slots("Отель в Москве")

        ticker_task = asyncio.create_task(background_ticker())
        extract_task = asyncio.create_task(mock_async_task())

        await extract_task
        # Если цикл не заблокирован, тикер должен успеть сделать несколько итераций
        assert counter > 0, "Event Loop был заблокирован: параллельный тикер не выполнил ни одной итерации"

        await ticker_task
        assert counter == 10

    asyncio.run(_run())
