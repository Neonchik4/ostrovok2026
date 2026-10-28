from app.services.response_generator import build_deterministic_agent_response
from app.services.slot_extractor import mock_extract_slots
from app.services.thought_generator import build_deterministic_reasoning


def test_thought_reasoning_richness():
    slots = mock_extract_slots("Отель в Санкт-Петербурге с кошкой и спа до 12000 р")
    reasoning = build_deterministic_reasoning("Отель в Санкт-Петербурге с кошкой и спа до 12000 р", slots)
    assert "Санкт-Петербург" in reasoning
    assert "питомц" in reasoning
    assert "СПА" in reasoning or "спа" in reasoning
    assert "12 000" in reasoning

def test_agent_response_empty_hotels():
    slots = mock_extract_slots("Отель в Москве")
    resp = build_deterministic_agent_response("Отель в Москве", slots, [])
    assert "не найдены" in resp
    assert "Москва" in resp

def test_agent_response_budget_exceeded():
    slots = mock_extract_slots("Отель в Сочи до 3000 руб")
    class DummyHotel:
        name = "Гранд Отель"
        city = "Сочи"
        min_price_per_night_rub = 6000
    dummy = DummyHotel()

    resp = build_deterministic_agent_response("Отель в Сочи до 3000 руб", slots, [dummy])
    assert "В рамках бюджета" in resp
    assert "6 000" in resp

def test_agent_response_with_origin_known_does_not_ask_origin():
    slots = mock_extract_slots("Отель в Санкт-Петербурге до 15000 руб")
    slots.origin_city = "Анапа"
    class DummyHotel:
        name = "Отель 25/7"
        city = "Санкт-Петербург"
        min_price_per_night_rub = 8000
    dummy = DummyHotel()

    resp = build_deterministic_agent_response("Отель в Санкт-Петербурге", slots, [dummy])
    assert "город вылета" not in resp.lower()
    assert "город выезда" not in resp.lower()

def test_agent_response_with_train_preference_mentions_train():
    slots = mock_extract_slots("Отель в Санкт-Петербурге хочу поезд")
    slots.origin_city = "Анапа"
    slots.total_trip_budget_rub = 50000
    class DummyHotel:
        name = "Отель 25/7"
        city = "Санкт-Петербург"
        min_price_per_night_rub = 8000
    dummy = DummyHotel()

    resp = build_deterministic_agent_response("Отель в Санкт-Петербурге хочу поезд", slots, [dummy])
    assert "поезд" in resp.lower()
    assert "рейс" not in resp.lower()
    assert "самолет" not in resp.lower()


def test_agent_response_two_clarifying_questions_for_anapa_to_moscow():
    slots = mock_extract_slots("хочу поехать из анапы в москву")
    class DummyHotel:
        name = "AZIMUT Сити Отель Смоленская"
        city = "Москва"
        min_price_per_night_rub = 7500
        stars = 4
    dummy = DummyHotel()

    resp = build_deterministic_agent_response("хочу поехать из анапы в москву", slots, [dummy])
    # Город выезда не должен переспрашиваться, так как Анапа уже указана
    assert "город выезда" not in resp.lower()
    assert "город вылета" not in resp.lower()
    assert "город отправления" not in resp.lower()
    # Должны быть заданы ровно 2 уточняющих вопроса: даты и транспорт
    assert "даты поездки" in resp.lower()
    assert "поезд или самолет" in resp.lower()


def test_thematic_warm_agent_response_and_search():
    slots = mock_extract_slots("хочу в теплые края россии")
    class DummyHotel:
        name = "AZIMUT Отель Сочи"
        city = "Сочи"
        min_price_per_night_rub = 8500
        stars = 4
    dummy = DummyHotel()

    resp = build_deterministic_agent_response("хочу в теплые края россии", slots, [dummy])
    assert "теплых краях" in resp.lower()
    assert "сочи" in resp.lower()
    assert "анапа" in resp.lower()
    assert "геленджик" in resp.lower()
    # Zero-emoji check
    assert not any(ord(char) > 0x1F600 for char in resp)
    assert ":)" not in resp


def test_agent_response_and_thoughts_mention_checkout():
    slots = mock_extract_slots("Отель в Москве, выезд в 19:00")
    class DummyHotel:
        name = "AZIMUT Отель Смоленская"
        city = "Москва"
        min_price_per_night_rub = 7000
        checkin_from = "14:00"
        checkout_until = "12:00"
    dummy = DummyHotel()

    resp = build_deterministic_agent_response("Отель в Москве, выезд в 19:00", slots, [dummy])
    assert "выезд до 12:00" in resp.lower()

    reasoning = build_deterministic_reasoning("Отель в Москве, выезд в 19:00", slots)
    assert "время выезда 19:00" in reasoning
    assert "check-out" in reasoning or "выезд" in reasoning


