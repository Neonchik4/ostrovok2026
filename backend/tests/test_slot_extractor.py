from app.services.slot_extractor import (
    default_chips,
    mock_extract_slots,
    sanitize_chips,
)


def test_mock_extract_slots_bounds():
    # Проверка клампинга гостей и ночей
    slots = mock_extract_slots("Отель в Москве на 50 человек на 150 ночей")
    assert slots.guests_count <= 20
    assert slots.nights <= 90

    # Проверка звезд
    slots_5 = mock_extract_slots("Отель в Сочи 5 звезд")
    assert slots_5.stars == 5

def test_mock_extract_slots_features():
    query = "Красная Поляна со спа, подогреваемым бассейном, завтраком и собакой до 25000 руб"
    slots = mock_extract_slots(query)
    assert slots.city == "Красная Поляна"
    assert slots.spa is True
    assert slots.heated_pool is True
    assert slots.breakfast_included is True
    assert slots.pet_friendly is True
    assert slots.max_price_per_night_rub == 25000

def test_sanitize_chips_security_and_prices():
    raw_chips = [
        "До 1 500 ₽ / ночь",
        "До 1 500 ₽ / ночь",  # дубликат
        "Слишком длинный чипс " * 10,
        "Только с завтраком",
    ]
    cleaned = sanitize_chips(raw_chips)
    assert len(cleaned) == 2
    assert "До 5 000 ₽ / ночь" in cleaned
    assert "Только с завтраком" in cleaned

def test_default_chips_action_format():
    chips = default_chips("отель у моря")
    assert len(chips) > 0
    for chip in chips:
        assert "?" not in chip
        assert not chip.startswith("Где")

def test_extract_route_origin_and_destination():
    # 1. Формат 'из Города в Город'
    s1 = mock_extract_slots("из Самары в Сочи на двоих")
    assert s1.origin_city == "Самара"
    assert s1.city == "Сочи"

    # 2. Формат 'откуда ... куда ...'
    s2 = mock_extract_slots("откуда: Москва, куда: Казань")
    assert s2.origin_city == "Москва"
    assert s2.city == "Казань"

    # 3. Дефисный маршрут
    s3 = mock_extract_slots("Санкт-Петербург - Шерегеш с собакой")
    assert s3.origin_city == "Санкт-Петербург"
    assert s3.city == "Шерегеш"

def test_extract_dates_and_total_trip_budget():
    # Неделя
    s1 = mock_extract_slots("отель в Сочи на неделю")
    assert s1.nights == 7

    # Выходные
    s2 = mock_extract_slots("поездка в Казань на выходные")
    assert s2.nights == 2

    # Диапазон дат
    s3 = mock_extract_slots("Казань с 15 по 20 ноября")
    assert s3.nights == 5

    # Общий бюджет на поездку
    s4 = mock_extract_slots("в Сочи на 2 ночи общий бюджет 50000 руб")
    assert s4.total_trip_budget_rub == 50000
    assert s4.max_price_per_night_rub is not None
    assert s4.max_price_per_night_rub > 0

def test_extract_origin_with_s_prep_and_transport_preference():
    # 1. "я буду лететь с анапы" -> orig="Анапа", dest=None
    s1 = mock_extract_slots("я буду лететь с анапы")
    assert s1.origin_city == "Анапа"
    assert s1.city is None

    # 2. "я полечу с анапы в питер" -> orig="Анапа", dest="Санкт-Петербург"
    s2 = mock_extract_slots("я полечу с анапы в питер")
    assert s2.origin_city == "Анапа"
    assert s2.city == "Санкт-Петербург"

    # 3. "хочу поезд" -> transport_preference="train", near_station=True
    s3 = mock_extract_slots("хочу поезд")
    assert s3.transport_preference == "train"
    assert s3.include_train is True
    assert s3.near_station is True

    # 4. "билеты на завтра" -> depart_date != None
    s4 = mock_extract_slots("хочу поезд в питер на завтра")
    assert s4.city == "Санкт-Петербург"
    assert s4.transport_preference == "train"
    assert s4.depart_date is not None

def test_multi_turn_anapa_to_spb_preserves_destination():
    from app.services.session_memory import merge_slots

    # Turn 1: user says "привет хочу слетать в питер"
    t1 = mock_extract_slots("привет хочу слетать в питер")
    assert t1.city == "Санкт-Петербург"
    assert t1.origin_city is None

    # Turn 2: user says "я буду лететь с анапы"
    t2 = mock_extract_slots("я буду лететь с анапы")
    assert t2.origin_city == "Анапа"
    assert t2.city is None

    merged_t2 = merge_slots(t1, t2)
    assert merged_t2.city == "Санкт-Петербург"
    assert merged_t2.origin_city == "Анапа"

    # Turn 3: user says "хочу поезд"
    t3 = mock_extract_slots("хочу поезд")
    assert t3.transport_preference == "train"

    merged_t3 = merge_slots(merged_t2, t3)
    assert merged_t3.city == "Санкт-Петербург"
    assert merged_t3.origin_city == "Анапа"
    assert merged_t3.transport_preference == "train"


def test_extract_slots_anapa_to_moscow_with_clarifying_chips():
    slots = mock_extract_slots("хочу поехать из анапы в москву")
    assert slots.origin_city == "Анапа"
    assert slots.city == "Москва"
    chips = slots.disambiguation_suggestions
    assert "Хочу на поезде" in chips
    assert "На самолете" in chips
    assert "В эти выходные" in chips
    assert "Вылет из Москвы" not in chips
    assert "Выезд из СПб" not in chips


def test_thematic_warm_destinations_not_fake_city():
    slots = mock_extract_slots("хочу в теплые края россии")
    # Strict determinism: NEVER invent fake city "Теплые"
    assert slots.city is None
    assert slots.thematic_category == "warm"
    assert "Сочи" in slots.candidate_cities
    assert "Анапа" in slots.candidate_cities
    assert "В Сочи" in slots.disambiguation_suggestions
    assert "В Анапу" in slots.disambiguation_suggestions


def test_thematic_sea_and_mountains_destinations():
    # 1. Море
    s_sea = mock_extract_slots("хочу на море с собакой")
    assert s_sea.city is None
    assert s_sea.thematic_category == "sea"
    assert s_sea.pet_friendly is True
    assert "Сочи" in s_sea.candidate_cities
    assert "В Сочи" in s_sea.disambiguation_suggestions

    # 2. Горы
    s_mount = mock_extract_slots("хочу в горы покататься на лыжах")
    assert s_mount.city is None
    assert s_mount.thematic_category == "mountains"
    assert "Красная Поляна" in s_mount.candidate_cities
    assert "Шерегеш" in s_mount.candidate_cities
    assert "Красная Поляна" in s_mount.disambiguation_suggestions


def test_thematic_multiturn_clarification_pins_city():
    from app.services.session_memory import merge_slots

    # Turn 1: user says "хочу в теплые края россии"
    t1 = mock_extract_slots("хочу в теплые края россии")
    assert t1.city is None
    assert t1.thematic_category == "warm"

    # Turn 2: user selects chip "В Анапу"
    t2 = mock_extract_slots("В Анапу")
    assert t2.city == "Анапа"

    merged = merge_slots(t1, t2)
    assert merged.city == "Анапа"
    assert merged.candidate_cities == []
    assert merged.thematic_category is None


def test_departure_time_and_late_checkout_extraction():
    # 1. Точное время выезда
    s1 = mock_extract_slots("Отель в Москве, выезд в 17:30")
    assert s1.departure_time == "17:30"

    # 2. Обратный поезд / рейс
    s2 = mock_extract_slots("Сочи, обратный поезд в 19:45")
    assert s2.departure_time == "19:45"

    # 3. Поздний выезд
    s3 = mock_extract_slots("Казань, нужен поздний выезд и оставить вещи")
    assert s3.needs_late_checkout is True
    assert s3.needs_luggage_storage is True
    assert s3.departure_time == "18:00"


