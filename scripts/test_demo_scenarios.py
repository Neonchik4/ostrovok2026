"""
E2E Verification of DEMO.md Jury Scenarios against live FastAPI endpoint.
Tests streaming SSE, thoughts, decomposed match score, and smart relaxation.
"""

import sys
import json
import re
import httpx

BASE_URL = "http://localhost:8000/api/chat/stream"


def parse_sse_events(raw_text: str):
    events = []
    # SSE events separated by double newlines
    blocks = re.split(r"\n\s*\n", raw_text.strip())
    for block in blocks:
        lines = block.strip().split("\n")
        event_type = None
        data_str = None
        for line in lines:
            if line.startswith("event:"):
                event_type = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data_str = line[len("data:"):].strip()
        if event_type and data_str:
            try:
                data_obj = json.loads(data_str)
            except Exception:
                data_obj = data_str
            events.append({"type": event_type, "data": data_obj})
    return events


def test_scenario_1_strict_constraints():
    query = "Хочу в Красную Поляну на 3 ночи с собакой и теплым бассейном до 25 000 рублей в сутки"
    print(f"\n[Scenario 1] Запрос: {query}")
    with httpx.Client(timeout=25.0) as client:
        resp = client.post(BASE_URL, json={"message": query})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    events = parse_sse_events(resp.text)
    
    thoughts = [e["data"] for e in events if e["type"] == "thought"]
    widgets = [e["data"] for e in events if e["type"] == "widget"]
    
    print(f"  + Мыслей в стриме: {len(thoughts)}")
    assert len(thoughts) >= 2, "Должно быть минимум 2 мысли рассуждения"
    assert len(widgets) >= 1, "Должен быть возвращен хотя бы один виджет отелей"
    
    first_widget = widgets[0]
    hotels = first_widget.get("hotels", [])
    print(f"  + Найдено отелей в виджете: {len(hotels)}")
    assert len(hotels) > 0, "Список отелей не должен быть пустым"
    
    first_hotel = hotels[0]
    print(f"  + Отель №1: {first_hotel.get('name')} (город: {first_hotel.get('city')}, score: {first_hotel.get('match_score_pct')}%)")
    assert "Красная Поляна" in first_hotel.get("city", "") or "Поляна" in first_hotel.get("city", "")
    
    breakdown = first_hotel.get("criteria_breakdown", [])
    print(f"  + Разложение критериев ({len(breakdown)} пунктов):")
    for c in breakdown:
        print(f"    - [{c.get('status')}] {c.get('criterion')}: {c.get('evidence')}")
    
    # Verify code_verified criteria exist
    code_verified = [c for c in breakdown if c.get("status") == "code_verified"]
    assert len(code_verified) >= 2, "Должны присутствовать кодовые проверки (бюджет, питомцы, бассейн)"
    print("  [OK] Сценарий 1 успешно пройден!")


def test_scenario_2_smart_relaxation():
    query = "Отель в Москве 5 звезд с бассейном до 2 000 рублей"
    print(f"\n[Scenario 2] Запрос с нереалистичными рамками: {query}")
    with httpx.Client(timeout=25.0) as client:
        resp = client.post(BASE_URL, json={"message": query})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    events = parse_sse_events(resp.text)
    
    widgets = [e["data"] for e in events if e["type"] == "widget"]
    assert len(widgets) >= 1, "Должен быть виджет"
    hotels = widgets[0].get("hotels", [])
    assert len(hotels) > 0, "Должны быть предложены альтернативные отели"
    
    # Check for compromise notes or relaxed breakdown
    hotel_with_compromise = next((h for h in hotels if h.get("compromise_note")), None)
    has_relaxed_crit = any(
        any(c.get("status") == "relaxed_compromise" for c in h.get("criteria_breakdown", []))
        for h in hotels
    )
    
    print(f"  + Первый отель: {hotels[0].get('name')}")
    if hotel_with_compromise:
        print(f"  + Баннер компромисса: {hotel_with_compromise.get('compromise_note')}")
    assert hotel_with_compromise or has_relaxed_crit, "Должен сработать Smart Relaxation с фиксацией компромисса"
    print("  [OK] Сценарий 2 успешно пройден!")


def test_scenario_3_semantic_reviews():
    query = "Тихий уютный отель в Сочи с потрясающим видом на море и вкусными завтраками"
    print(f"\n[Scenario 3] Семантический запрос: {query}")
    with httpx.Client(timeout=25.0) as client:
        resp = client.post(BASE_URL, json={"message": query})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    events = parse_sse_events(resp.text)
    
    widgets = [e["data"] for e in events if e["type"] == "widget"]
    assert len(widgets) >= 1
    hotels = widgets[0].get("hotels", [])
    assert len(hotels) > 0
    
    first_hotel = hotels[0]
    print(f"  + Отель №1: {first_hotel.get('name')}")
    print(f"  + Match Score: {first_hotel.get('match_score_pct')}%")
    
    breakdown = first_hotel.get("criteria_breakdown", [])
    semantic_items = [c for c in breakdown if c.get("status") == "semantic_match"]
    print(f"  + Семантических критериев: {len(semantic_items)}")
    for s in semantic_items:
        print(f"    - {s.get('criterion')}: {s.get('evidence')}")
    
    assert len(semantic_items) >= 1, "Должно быть семантическое обоснование"
    print("  [OK] Сценарий 3 успешно пройден!")


def main():
    print("=" * 60)
    print("Запуск сквозной верификации сценариев демонстрации DEMO.md")
    print("=" * 60)
    try:
        test_scenario_1_strict_constraints()
        test_scenario_2_smart_relaxation()
        test_scenario_3_semantic_reviews()
        print("\n" + "=" * 60)
        print("ВСЕ 3 СЦЕНАРИЯ ДЕМОНСТРАЦИИ ПОЛНОСТЬЮ ВЕРИФИЦИРОВАНЫ!")
        print("=" * 60)
    except AssertionError as e:
        print(f"\n[FAIL] Ошибка верификации: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Сетевая или системная ошибка: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
