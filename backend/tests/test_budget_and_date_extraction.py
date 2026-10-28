from app.schemas.chat import ExtractedSlots
from app.schemas.hotel_models import (
    Amenities,
    Coordinates,
    HotelFullSchema,
    LocationDetails,
    Policies,
    ReviewsSummary,
)
from app.services.hotel_filters import matches_scalar_filters
from app.services.response_generator import (
    build_deterministic_concierge_response,
    get_missing_clarifying_questions,
)
from app.services.route_extractor import extract_depart_date
from app.services.slot_extractor import mock_extract_slots


def _create_hotel(hotel_id: str, name: str, min_price: int, stars: int = 4) -> HotelFullSchema:
    return HotelFullSchema(
        id=hotel_id,
        name=name,
        city="Владивосток",
        stars=stars,
        area="Центр",
        area_type="city",
        address="ул. Светланская, 10",
        rating=9.0,
        reviews_count=100,
        reviews_summary=ReviewsSummary(),
        min_price_per_night_rub=min_price,
        image_urls=[],
        amenities=Amenities(spa=True),
        policies=Policies(),
        coordinates=Coordinates(lat=43.11, lon=131.88),
        location_details=LocationDetails(),
    )


def test_total_budget_flexible_word_order():
    """Тест поддержки произвольного порядка слов в выражении общего бюджета."""
    # Число перед словом 'бюджет'
    s1 = mock_extract_slots("67 тыс руб бюджет и с 28 по 30 собираемся ехать с девушкой вдвоем")
    assert s1.total_trip_budget_rub == 67000
    assert s1.max_price_per_night_rub is not None
    assert s1.max_price_per_night_rub <= 35000

    # Слово 'бюджет' перед числом
    s2 = mock_extract_slots("бюджет 67000р вдвоем в Сочи")
    assert s2.total_trip_budget_rub == 67000

    # 'на всё' после числа
    s3 = mock_extract_slots("67000 на всё в Казань")
    assert s3.total_trip_budget_rub == 67000

    # 'общий бюджет' с буквой 'к'
    s4 = mock_extract_slots("67к общий бюджет во Владивосток")
    assert s4.total_trip_budget_rub == 67000

    # 'под ключ'
    s5 = mock_extract_slots("под ключ до 80 000 руб вдвоем на море")
    assert s5.total_trip_budget_rub == 80000

    # Явно за ночь: НЕ должен становиться общим бюджетом
    s6 = mock_extract_slots("до 10 000 руб за ночь с бассейном")
    assert s6.total_trip_budget_rub is None
    assert s6.max_price_per_night_rub == 10000


def test_date_range_depart_date_extraction():
    """Тест извлечения даты заезда из числовых диапазонов ('с 28 по 30')."""
    d1 = extract_depart_date("67 тыс руб бюджет и с 28 по 30 собираемся ехать с девушкой вдвоем")
    assert d1 is not None
    assert d1.endswith("-28")

    d2 = extract_depart_date("с 28 по 30 октября во Владивосток")
    assert d2 == "2026-10-28"

    d3 = extract_depart_date("с 5 по 8 ноября в Сочи")
    assert d3 == "2026-11-05"

    d4 = extract_depart_date("15 декабря в Казань")
    assert d4 == "2026-12-15"


def test_cross_month_and_cross_year_dates_and_nights():
    """Тест надежного расчета ночей и дат заезда при кросс-месячных диапазонах."""
    # с 25 ноября по 1 декабря -> 6 ночей
    s1 = mock_extract_slots("Отель в Сочи с 25 ноября по 1 декабря")
    assert s1.depart_date == "2026-11-25"
    assert s1.nights == 6

    # с 28 февраля по 5 марта -> 5 ночей
    s2 = mock_extract_slots("поездка в Казань с 28 февраля по 5 марта")
    assert s2.depart_date == "2027-02-28"
    assert s2.nights == 5

    # с 30 декабря по 5 января -> 6 ночей (через Новый год)
    s3 = mock_extract_slots("Шерегеш с 30 декабря по 5 января")
    assert s3.depart_date == "2026-12-30"
    assert s3.nights == 6

    # с 1 июля по 14 июля -> 13 ночей
    s4 = mock_extract_slots("Ищем отель в Сочи с 1 июля по 14 июля")
    assert s4.depart_date == "2027-07-01"
    assert s4.nights == 13

    # с 30 декабря по 5 января 2027 (год в конце)
    s5 = mock_extract_slots("с 30 декабря по 5 января 2027")
    assert s5.depart_date == "2026-12-30"
    assert s5.nights == 6

    # с 25 по 1 декабря (месяц только в конце диапазона)
    s6 = mock_extract_slots("с 25 по 1 декабря в Москву")
    assert s6.depart_date == "2026-11-25"
    assert s6.nights == 6

    # Числовой формат с 25.11 по 01.12
    s7 = mock_extract_slots("с 25.11 по 01.12 в Сочи")
    assert s7.depart_date == "2026-11-25"
    assert s7.nights == 6


def test_scalar_filters_enforce_total_trip_budget():
    """Скалярный фильтр обязан отсекать отель, если даже базовая стоимость проживания превышает total_trip_budget_rub."""
    expensive_hotel = _create_hotel("h_exp", "Rodina Гранд Отель", 35591, stars=5)
    affordable_hotel = _create_hotel("h_aff", "Отель Lido Central", 9013, stars=3)

    slots = ExtractedSlots(
        city="Владивосток",
        total_trip_budget_rub=67000,
        nights=2,
        guests_count=2,
    )

    # 35 591 * 2 = 71 182 > 67 000 -> отель отсекается
    assert not matches_scalar_filters(expensive_hotel, slots)

    # 9 013 * 2 = 18 026 <= 67 000 -> отель проходит
    assert matches_scalar_filters(affordable_hotel, slots)


def test_response_generator_handles_user_dispute():
    """При вопросе-претензии ('почему 82000 вместо 67000') агент отвечает по существу и не навязывает попугай-вопросы."""
    slots = ExtractedSlots(
        city="Владивосток",
        total_trip_budget_rub=67000,
        depart_date="2026-10-28",
        nights=2,
        guests_count=2,
        origin_city="Москва",
        transport_preference="flight",
    )

    # Все ключевые параметры известны
    missing = get_missing_clarifying_questions(slots)
    assert "даты поездки" not in missing
    assert "город выезда" not in missing

    affordable_hotel = _create_hotel("h_aff", "Отель Lido Central", 9013, stars=3)

    response = build_deterministic_concierge_response(
        "почему я пишу бюджет 67000р а ты предлагаешь под ключ за 82000р?",
        slots,
        [affordable_hotel],
    )

    assert "Скорректировал выборку строго под ваш суммарный бюджет под ключ" in response
    assert "На какие даты планируете поездку" not in response
