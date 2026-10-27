"""
Стресс-бенчмарк AI-агента консьержа (7 когорт по 3 нестандартных кейса = 21 запрос).

Оценивает устойчивость детерминированного пайплайна агента к запросам вне базового распределения:
1. Сленг, сокращения, неформальная лексика и опечатки (СПб, сочик, екб);
2. Парадоксальные и взаимоисключающие требования (5 звезд за 2000р, тишина для вечеринки);
3. Нестандартный состав гостей и питомцы кроме собак (кошки, 12 человек, МГН);
4. Эмоциональные и вдохновляющие запросы без дат и городов (горы, теплые края, сияние);
5. Разговорные и сезонные временные ориентиры (бархатный сезон, через неделю, майские);
6. Условные ветвления и мульти-интенты (если плохая погода, такси от вокзала, отель + экскурсия);
7. Граничные атаки, инъекции и экстремальные значения (jailbreak, 100 человек, SQL-инъекция).

Ключевой фокус: проверка смысловой адекватности (semantic validity), безопасного клампинга,
отсутствия падений и точности фильтрации угроз.
"""

import json
import time
from pathlib import Path

import pytest

from app.services.guardrails import classify_request
from app.services.hotel_search_adapter import search_hotels_with_telemetry
from app.services.slot_extractor import mock_extract_slots

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "stress_benchmark_prompts.json"


def load_stress_prompts() -> list[dict]:
    with open(FIXTURES_PATH, encoding="utf-8") as f:
        return json.load(f)


STRESS_PROMPTS = load_stress_prompts()


def test_stress_dataset_structure_and_cohort_integrity():
    """Проверка структуры: ровно 21 кейс, 7 когорт, ровно по 3 кейса в каждой когорте."""
    assert len(STRESS_PROMPTS) == 21, "Стресс-бенчмарк обязан содержать ровно 21 запрос"

    unique_ids = {item["id"] for item in STRESS_PROMPTS}
    assert len(unique_ids) == 21, "Все ID промптов обязаны быть уникальными"

    cohorts = {}
    for item in STRESS_PROMPTS:
        c_id = item["cohort_id"]
        cohorts.setdefault(c_id, []).append(item)

    assert len(cohorts) == 7, "Должно быть ровно 7 когорт"
    for c_id, items in cohorts.items():
        assert len(items) == 3, f"Когорта {c_id} обязана содержать ровно 3 запроса"

    for item in STRESS_PROMPTS:
        assert isinstance(item.get("prompt"), str) and len(item["prompt"]) > 0
        assert item.get("expected_verdict") in {"travel", "injection", "offtopic"}
        assert isinstance(item.get("stress_focus"), str) and len(item["stress_focus"]) > 0
        assert isinstance(item.get("challenge_description"), str) and len(item["challenge_description"]) > 0


@pytest.mark.parametrize("item", STRESS_PROMPTS, ids=lambda x: x["id"])
def test_individual_stress_prompt_execution(item: dict):
    """Индивидуальное тестирование каждого из 21 стресс-промптов."""
    prompt = item["prompt"]
    expected_verdict = item["expected_verdict"]
    expected_intent = item["expected_intent"]
    expected_slots = item["expected_slots"]

    # 1. Замер задержки классификации безопасности и Guardrails
    t0 = time.perf_counter()
    verdict = classify_request(prompt)
    latency_ms = (time.perf_counter() - t0) * 1000

    assert verdict == expected_verdict, (
        f"Prompt [{item['id']}] '{prompt}': expected verdict '{expected_verdict}', got '{verdict}'"
    )

    # 2. Если вердикт travel — проверяем детерминированную экстракцию слотов
    if verdict == "travel":
        t1 = time.perf_counter()
        slots = mock_extract_slots(prompt)
        slot_latency_ms = (time.perf_counter() - t1) * 1000

        total_latency_ms = latency_ms + slot_latency_ms
        assert total_latency_ms < 100.0, f"Prompt [{item['id']}] latency exceeded 100ms: {total_latency_ms:.2f}ms"

        # Проверка интента
        assert slots.intent == expected_intent, (
            f"Prompt [{item['id']}]: expected intent '{expected_intent}', got '{slots.intent}'"
        )

        # Проверка смысловых слотов
        for slot_key, expected_val in expected_slots.items():
            actual_val = getattr(slots, slot_key, None)
            assert actual_val == expected_val, (
                f"Prompt [{item['id']}] '{prompt}': slot '{slot_key}' expected {expected_val}, got {actual_val}"
            )

        # Проверка инвариантов безопасности (Secure by Design)
        assert 1 <= slots.guests_count <= 20, (
            f"Prompt [{item['id']}]: guests count {slots.guests_count} out of bounds 1..20"
        )
        assert 1 <= slots.nights <= 90, (
            f"Prompt [{item['id']}]: nights {slots.nights} out of bounds 1..90"
        )


def test_stress_cohort_performance_breakdown():
    """Сводный анализ качества работы пайплайна по всем 7 когортам."""
    cohort_results: dict[int, dict] = {}

    for item in STRESS_PROMPTS:
        c_id = item["cohort_id"]
        c_name = item["cohort_name"]
        if c_id not in cohort_results:
            cohort_results[c_id] = {
                "name": c_name,
                "title": item["cohort_title"],
                "total": 0,
                "verdict_ok": 0,
                "intent_ok": 0,
                "slots_checked": 0,
                "slots_ok": 0,
                "latencies": [],
            }

        rec = cohort_results[c_id]
        rec["total"] += 1

        t0 = time.perf_counter()
        verdict = classify_request(item["prompt"])
        if verdict == item["expected_verdict"]:
            rec["verdict_ok"] += 1

        if verdict == "travel":
            slots = mock_extract_slots(item["prompt"])
            if slots.intent == item["expected_intent"]:
                rec["intent_ok"] += 1

            for k, expected_v in item["expected_slots"].items():
                rec["slots_checked"] += 1
                if getattr(slots, k, None) == expected_v:
                    rec["slots_ok"] += 1

        elapsed = (time.perf_counter() - t0) * 1000
        rec["latencies"].append(elapsed)

    # Валидация метрик по каждой когорте
    for c_id, stats in cohort_results.items():
        assert stats["verdict_ok"] == stats["total"], (
            f"Cohort {c_id} ({stats['name']}) failed verdict check: {stats['verdict_ok']}/{stats['total']}"
        )
        if stats["slots_checked"] > 0:
            assert stats["slots_ok"] == stats["slots_checked"], (
                f"Cohort {c_id} ({stats['name']}) failed slots check: {stats['slots_ok']}/{stats['slots_checked']}"
            )
        avg_lat = sum(stats["latencies"]) / len(stats["latencies"])
        assert avg_lat < 50.0, f"Cohort {c_id} ({stats['name']}) latency too high: {avg_lat:.2f}ms"


@pytest.mark.asyncio
async def test_stress_search_adapters_behavior():
    """
    Проверка реакции поискового адаптера (hotel_search_adapter) на все 21 стресс-запрос:
    - Отсутствие необработанных падений и исключений (Secure by Design);
    - Парадоксальные запросы (5 звезд за 2000р) активируют smart relaxation;
    - Запросы вне каталога (Ярославль) отдают 0 карточек без сбоя (graceful degradation);
    - Эмоциональные тематические запросы (горы, тепло, природа) возвращают отели по кандидатам;
    - Экстремальный размер группы (100 человек) клампится до 20;
    - Попытка SQL-инъекции санитизируется и выполняет поиск по Москве.
    """
    for item in STRESS_PROMPTS:
        verdict = classify_request(item["prompt"])
        if verdict != "travel":
            continue

        slots = mock_extract_slots(item["prompt"])
        cards, telem = await search_hotels_with_telemetry(slots)

        assert isinstance(cards, list)
        assert telem is not None

        # Специфические проверки поведения адаптера
        if item["id"] == "stress_conflict_01":
            # 5 звезд за 2000р на неделю не существуют: релаксация ограничений обязана сработать
            assert telem.is_relaxed is True, "Парадоксальный бюджет обязан приводить к релаксации"

        elif item["id"] == "stress_calendar_02":
            # Ярославль отсутствует в каталоге из 19 регионов: корректная пустая выдача
            assert len(cards) == 0, "Город вне 19 направлений каталога должен возвращать 0 карточек"

        elif item["id"] == "stress_boundary_02":
            # 100 человек клампятся в 20
            assert slots.guests_count == 20
            assert len(cards) > 0, "Шерегеш обязан вернуть отели для группы"

        elif item["id"] == "stress_boundary_03":
            # SQL-инъекция санитизирована
            assert slots.city == "Москва"
            assert len(cards) > 0, "Москва обязана вернуть отели даже при попытке SQL-инъекции"

        elif item["cohort_name"] == "vague_mood_and_inspiration":
            # Тематические запросы без города возвращают релевантные карточки по кандидатам
            assert len(cards) > 0, f"Тематический запрос [{item['id']}] обязан найти отели"

