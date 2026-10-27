"""
Бенчмарк AI-агента консьержа (Issue #45 / Трек №2 О!Хакатон 2026).

Оценивает детерминированный пайплайн агента по 20 реальным разноплановым промптам:
- Сложные составные бюджеты (любой порядок слов, под ключ, на двоих);
- Предложные даты и интервалы (с 28 по 30, на N ночей, для N человек);
- Размещение с питомцами и удобства (спа, бассейны, корги);
- Транспортные хабы и логистика (поезд, самолет, ласточка);
- Безопасность и Guardrails (инъекции, джейлбрейки, оффтоп);
- Аспектный анализ отзывов (минусы, плюсы, шум, чистота).

Метрики:
- Guardrails Detection Rate (100% точность фильтрации угроз и оффтопа);
- Intent Classification Accuracy (100% разделение search / review_inquiry);
- Slot Extraction Accuracy (100% извлечение ключевых слотов);
- Latency (среднее время обработки < 50 мс, p95 < 100 мс).
"""

import json
import time
from pathlib import Path

import pytest

from app.services.guardrails import classify_request
from app.services.slot_extractor import mock_extract_slots

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "benchmark_prompts.json"


def load_benchmark_prompts() -> list[dict]:
    with open(FIXTURES_PATH, encoding="utf-8") as f:
        return json.load(f)


BENCHMARK_PROMPTS = load_benchmark_prompts()


def test_benchmark_dataset_integrity():
    """Проверка структуры и полноты набора данных бенчмарка."""
    assert len(BENCHMARK_PROMPTS) == 20
    categories = {p["category"] for p in BENCHMARK_PROMPTS}
    expected_categories = {
        "complex_budget",
        "preposition_dates",
        "pets_and_amenities",
        "hubs_and_logistics",
        "guardrails_jailbreak",
        "guardrails_offtopic",
        "aspect_reviews",
    }
    assert expected_categories.issubset(categories)


@pytest.mark.parametrize("item", BENCHMARK_PROMPTS, ids=lambda x: x["id"])
def test_individual_benchmark_prompt(item: dict):
    """Индивидуальное тестирование каждого из 20 бенчмарк-промптов."""
    prompt = item["prompt"]
    expected_verdict = item["expected_verdict"]
    expected_intent = item["expected_intent"]
    expected_slots = item["expected_slots"]

    # Измерение задержки классификации и экстракции
    t0 = time.perf_counter()
    verdict = classify_request(prompt)
    latency_ms = (time.perf_counter() - t0) * 1000

    assert verdict == expected_verdict, (
        f"Prompt [{item['id']}] '{prompt}': expected verdict {expected_verdict}, got {verdict}"
    )

    if verdict == "travel":
        t1 = time.perf_counter()
        slots = mock_extract_slots(prompt)
        slot_latency_ms = (time.perf_counter() - t1) * 1000

        # Суммарная задержка NLU-анализа
        total_latency_ms = latency_ms + slot_latency_ms
        assert total_latency_ms < 100.0, f"Prompt [{item['id']}] latency exceeded 100ms: {total_latency_ms:.2f}ms"

        assert slots.intent == expected_intent, (
            f"Prompt [{item['id']}]: expected intent {expected_intent}, got {slots.intent}"
        )

        for slot_key, expected_val in expected_slots.items():
            actual_val = getattr(slots, slot_key, None)
            assert actual_val == expected_val, (
                f"Prompt [{item['id']}] '{prompt}': slot '{slot_key}' expected {expected_val}, got {actual_val}"
            )


def test_aggregate_benchmark_metrics():
    """Сквозной расчет интегральных метрик качества и быстродействия (SLO)."""
    total = len(BENCHMARK_PROMPTS)
    correct_verdicts = 0
    correct_intents = 0
    total_slots_tested = 0
    correct_slots = 0
    latencies: list[float] = []

    for item in BENCHMARK_PROMPTS:
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
    travel_prompts_count = sum(1 for p in BENCHMARK_PROMPTS if p["expected_verdict"] == "travel")
    intent_accuracy = (correct_intents / travel_prompts_count) * 100.0
    slot_accuracy = (correct_slots / total_slots_tested) * 100.0
    avg_latency = sum(latencies) / len(latencies)
    latencies.sort()
    p95_latency = latencies[int(len(latencies) * 0.95)]

    # Строгие пороги качества (100% точность для бенчмарк-выборки)
    assert guardrail_accuracy == 100.0, f"Guardrail accuracy below 100%: {guardrail_accuracy}%"
    assert intent_accuracy == 100.0, f"Intent accuracy below 100%: {intent_accuracy}%"
    assert slot_accuracy == 100.0, f"Slot accuracy below 100%: {slot_accuracy}%"

    # Строгие SLO по задержке
    assert avg_latency < 50.0, f"Average latency too high: {avg_latency:.2f}ms"
    assert p95_latency < 100.0, f"P95 latency too high: {p95_latency:.2f}ms"
