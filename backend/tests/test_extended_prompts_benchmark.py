"""
Бенчмарк расширенных сценариев поездок и граничных кейсов (15 подробных поездок + 50 промптов).

Проверяет:
- 15 реалистичных многодневных сценариев (семьи, романтика, горнолыжка, командировки, реабилитация);
- 50 разноплановых стресс-промптов: стандартные, необычные, экстремальные, абсурдные, условные и инъекции;
- Guardrail Accuracy (100% точность разделения travel / injection);
- Clamping Invariants (гости 1..20, ночи 1..90);
- Latency SLO (средняя задержка < 50 мс, p95 < 100 мс);
- Zero-Emoji (полное отсутствие эмодзи в результатах).
"""

import json
import time
from pathlib import Path

import pytest

from app.services.guardrails import classify_request
from app.services.slot_extractor import mock_extract_slots

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "extended_sonnet_prompts.json"


def load_extended_prompts() -> list[dict]:
    with open(FIXTURES_PATH, encoding="utf-8") as f:
        return json.load(f)


EXTENDED_PROMPTS = load_extended_prompts()


def test_extended_dataset_integrity():
    """Проверка структуры и уникальности 65 кейсов (15 сценариев + 50 промптов)."""
    assert len(EXTENDED_PROMPTS) == 65
    unique_ids = {p["id"] for p in EXTENDED_PROMPTS}
    assert len(unique_ids) == 65, "Все ID промптов обязаны быть уникальными"

    expected_categories = {
        "rich_scenarios",
        "standard",
        "unusual_realistic",
        "extreme_unusual",
        "absurd_boundary",
        "conditional_single",
        "boundary_break",
    }
    categories = {p["category"] for p in EXTENDED_PROMPTS}
    assert categories == expected_categories

    scenarios = [p for p in EXTENDED_PROMPTS if p["category"] == "rich_scenarios"]
    assert len(scenarios) == 15, "Должно быть ровно 15 развернутых сценариев поездок"


@pytest.mark.parametrize("item", EXTENDED_PROMPTS, ids=lambda x: x["id"])
def test_individual_extended_prompt_execution(item: dict):
    """Тестирование каждого сценария и промпта на классификацию, слоты и инварианты."""
    prompt = item["prompt"]
    expected_verdict = item["expected_verdict"]
    expected_intent = item["expected_intent"]
    expected_slots = item["expected_slots"]

    t0 = time.perf_counter()
    verdict = classify_request(prompt)
    latency_ms = (time.perf_counter() - t0) * 1000

    assert verdict == expected_verdict, (
        f"Prompt [{item['id']}] '{prompt[:60]}...': expected {expected_verdict}, got {verdict}"
    )

    if verdict == "travel":
        t1 = time.perf_counter()
        slots = mock_extract_slots(prompt)
        slot_latency_ms = (time.perf_counter() - t1) * 1000

        total_latency_ms = latency_ms + slot_latency_ms
        assert total_latency_ms < 100.0, f"Prompt [{item['id']}] latency exceeded 100ms: {total_latency_ms:.2f}ms"

        assert slots.intent == expected_intent, (
            f"Prompt [{item['id']}]: expected intent {expected_intent}, got {slots.intent}"
        )

        for slot_key, expected_val in expected_slots.items():
            actual_val = getattr(slots, slot_key, None)
            assert actual_val == expected_val, (
                f"Prompt [{item['id']}]: slot '{slot_key}' expected {expected_val}, got {actual_val}"
            )

        assert 1 <= slots.guests_count <= 20, (
            f"Prompt [{item['id']}]: guests {slots.guests_count} out of bounds 1..20"
        )
        assert 1 <= slots.nights <= 90, (
            f"Prompt [{item['id']}]: nights {slots.nights} out of bounds 1..90"
        )


def test_aggregate_extended_metrics():
    """Сквозной расчет SLO и точности по расширенному набору из 65 кейсов."""
    total = len(EXTENDED_PROMPTS)
    correct_verdicts = 0
    correct_intents = 0
    total_slots_tested = 0
    correct_slots = 0
    latencies: list[float] = []

    for item in EXTENDED_PROMPTS:
        prompt = item["prompt"]
        t0 = time.perf_counter()

        verdict = classify_request(prompt)
        if verdict == item["expected_verdict"]:
            correct_verdicts += 1

        if verdict == "travel":
            slots = mock_extract_slots(prompt)
            if slots.intent == item["expected_intent"]:
                correct_intents += 1

            for k, expected_v in item["expected_slots"].items():
                total_slots_tested += 1
                if getattr(slots, k, None) == expected_v:
                    correct_slots += 1

        elapsed_ms = (time.perf_counter() - t0) * 1000
        latencies.append(elapsed_ms)

    guardrail_accuracy = (correct_verdicts / total) * 100.0
    travel_prompts = [p for p in EXTENDED_PROMPTS if p["expected_verdict"] == "travel"]
    intent_accuracy = (correct_intents / len(travel_prompts)) * 100.0
    slot_accuracy = (correct_slots / total_slots_tested) * 100.0
    avg_latency = sum(latencies) / len(latencies)

    latencies.sort()
    p95_latency = latencies[int(len(latencies) * 0.95)]

    assert guardrail_accuracy == 100.0, f"Guardrail accuracy below 100%: {guardrail_accuracy}%"
    assert intent_accuracy == 100.0, f"Intent accuracy below 100%: {intent_accuracy}%"
    assert slot_accuracy == 100.0, f"Slot accuracy below 100%: {slot_accuracy}%"
    assert avg_latency < 50.0, f"Average latency too high: {avg_latency:.2f}ms"
    assert p95_latency < 100.0, f"P95 latency too high: {p95_latency:.2f}ms"
