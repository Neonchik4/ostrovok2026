from app.services.route_extractor import (
    default_chips,
    extract_depart_date,
    extract_route_cities,
    extract_transport_preference,
    extract_trip_dates,
    sanitize_chips,
)


def test_extract_trip_dates_cross_month_and_cross_year():
    """Проверка вычисления дат заезда и ночей через границы месяцев и лет."""
    # с 25 ноября по 1 декабря -> 6 ночей
    date1, nights1 = extract_trip_dates("с 25 ноября по 1 декабря")
    assert date1 == "2026-11-25"
    assert nights1 == 6

    # с 28 февраля по 5 марта -> 5 ночей
    date2, nights2 = extract_trip_dates("с 28 февраля по 5 марта")
    assert date2 == "2027-02-28"
    assert nights2 == 5

    # с 30 декабря по 5 января -> 6 ночей (через Новый год)
    date3, nights3 = extract_trip_dates("с 30 декабря по 5 января")
    assert date3 == "2026-12-30"
    assert nights3 == 6

    # с 1 июля по 14 июля -> 13 ночей
    date4, nights4 = extract_trip_dates("с 1 июля по 14 июля")
    assert date4 == "2027-07-01"
    assert nights4 == 13

    # с 30 декабря 2026 по 5 января 2027
    date5, nights5 = extract_trip_dates("с 30 декабря 2026 по 5 января 2027")
    assert date5 == "2026-12-30"
    assert nights5 == 6

    # с 30 декабря по 5 января 2027 (год только в конце диапазона)
    date6, nights6 = extract_trip_dates("с 30 декабря по 5 января 2027")
    assert date6 == "2026-12-30"
    assert nights6 == 6


def test_extract_trip_dates_short_month_range():
    """Проверка сокращенных диапазонов с указанием месяца только в конце."""
    # с 25 по 1 декабря -> 25 ноября по 1 декабря -> 6 ночей
    date1, nights1 = extract_trip_dates("с 25 по 1 декабря")
    assert date1 == "2026-11-25"
    assert nights1 == 6

    # с 28 по 5 марта -> 28 февраля по 5 марта -> 5 ночей
    date2, nights2 = extract_trip_dates("с 28 по 5 марта")
    assert date2 == "2027-02-28"
    assert nights2 == 5

    # с 30 по 5 января -> 30 декабря по 5 января -> 6 ночей
    date3, nights3 = extract_trip_dates("с 30 по 5 января")
    assert date3 == "2026-12-30"
    assert nights3 == 6

    # с 10 по 15 июля -> в одном месяце -> 5 ночей
    date4, nights4 = extract_trip_dates("с 10 по 15 июля")
    assert date4 == "2027-07-10"
    assert nights4 == 5


def test_extract_trip_dates_numeric_formats():
    """Проверка диапазонов дат в числовом формате (DD.MM)."""
    # с 25.11 по 01.12
    date1, nights1 = extract_trip_dates("с 25.11 по 01.12")
    assert date1 == "2026-11-25"
    assert nights1 == 6

    # 25.11 - 01.12
    date2, nights2 = extract_trip_dates("25.11 - 01.12")
    assert date2 == "2026-11-25"
    assert nights2 == 6

    # Одиночная числовая дата
    date3, nights3 = extract_trip_dates("вылет 25.11")
    assert date3 == "2026-11-25"
    assert nights3 is None


def test_extract_trip_dates_relative_and_single():
    """Проверка относительных и одиночных дат."""
    date_today, nights_today = extract_trip_dates("нужен отель сегодня")
    assert date_today is not None
    assert nights_today is None

    date_tomorrow, nights_tomorrow = extract_trip_dates("завтра в Москву")
    assert date_tomorrow is not None
    assert nights_tomorrow is None

    date_single, nights_single = extract_trip_dates("15 декабря в Казань")
    assert date_single == "2026-12-15"
    assert nights_single is None


def test_extract_depart_date_helper():
    """Проверка вспомогательного метода extract_depart_date."""
    assert extract_depart_date("с 25 ноября по 1 декабря") == "2026-11-25"
    assert extract_depart_date("15 декабря в Казань") == "2026-12-15"


def test_extract_route_cities_variations():
    """Проверка извлечения городов отправления и прибытия."""
    orig1, dest1 = extract_route_cities("из Москвы в Сочи на выходные")
    assert orig1 == "Москва"
    assert dest1 == "Сочи"

    orig2, dest2 = extract_route_cities("Санкт-Петербург - Казань")
    assert orig2 == "Санкт-Петербург"
    assert dest2 == "Казань"

    orig3, dest3 = extract_route_cities("хочу в Сочи")
    assert orig3 is None
    assert dest3 == "Сочи"


def test_extract_transport_preference():
    """Проверка распознавания транспортных предпочтений."""
    flight_only = extract_transport_preference("хочу лететь на самолете")
    assert flight_only == (True, False, "flight")

    train_only = extract_transport_preference("поедем на поезде")
    assert train_only == (False, True, "train")

    both = extract_transport_preference("билеты на поезд или самолет")
    assert both == (True, True, "both")

    none_pref = extract_transport_preference("отель с бассейном")
    assert none_pref == (None, None, None)


def test_sanitize_and_default_chips():
    """Проверка генерации и санитизации чипсов."""
    chips = default_chips("отель у моря")
    assert len(chips) > 0
    sanitized = sanitize_chips(["До 1 500 ₽ / ночь", "Только с завтраком"])
    assert "До 5 000 ₽ / ночь" in sanitized
    assert "Только с завтраком" in sanitized

