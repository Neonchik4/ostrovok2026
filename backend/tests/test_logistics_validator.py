
from app.schemas.hotel_models import (
    Amenities,
    HotelFullSchema,
    LocationDetails,
    Policies,
    ReviewsSummary,
)
from app.services.logistics_validator import (
    format_minutes_to_time,
    parse_time_to_minutes,
    validate_arrival_checkin_match,
    validate_departure_checkout_match,
)


def test_parse_and_format_time():
    assert parse_time_to_minutes("07:00") == 7 * 60
    assert parse_time_to_minutes("7:30") == 7 * 60 + 30
    assert parse_time_to_minutes("14:15") == 14 * 60 + 15
    assert parse_time_to_minutes("8 утра") == 8 * 60
    assert parse_time_to_minutes(None) is None
    assert parse_time_to_minutes("") is None

    assert format_minutes_to_time(7 * 60 + 45) == "07:45"
    assert format_minutes_to_time(14 * 60) == "14:00"


def _make_dummy_hotel(
    checkin="14:00",
    checkout="12:00",
    has_24h=False,
    has_early=False,
    has_late=False,
    has_luggage=False,
) -> HotelFullSchema:
    return HotelFullSchema(
        id="hotel-test-1",
        name="Отель Тест",
        city="Сочи",
        stars=4,
        area="Центр",
        area_type="center",
        address="ул. Ленина 1",
        min_price_per_night_rub=5000,
        rating=9.0,
        reviews_count=50,
        checkin_from=checkin,
        checkout_until=checkout,
        has_24h_front_desk=has_24h,
        has_early_checkin=has_early,
        has_luggage_storage=has_luggage,
        location_details=LocationDetails(),
        amenities=Amenities(
            has_24h_front_desk=has_24h,
            has_early_checkin=has_early,
            has_luggage_storage=has_luggage,
        ),
        policies=Policies(
            check_in_time=checkin,
            check_out_time=checkout,
            early_check_in_available=has_early,
            late_check_out_available=has_late,
        ),
        reviews_summary=ReviewsSummary(),
    )


def test_early_arrival_with_early_checkin_service():
    hotel = _make_dummy_hotel(has_early=True)
    res = validate_arrival_checkin_match("08:00", hotel)
    assert res["has_conflict"] is False
    assert res["is_positive"] is True
    assert res["status"] == "early_checkin_ready"
    assert "раннего заезда" in res["evidence"]


def test_early_arrival_with_24h_front_desk():
    hotel = _make_dummy_hotel(has_24h=True)
    res = validate_arrival_checkin_match("07:30", hotel)
    assert res["has_conflict"] is False
    assert res["is_positive"] is True
    assert "круглосуточная стойка" in res["evidence"]


def test_early_arrival_conflict_when_no_safeguards():
    """Тест: прилет в 07:00, заезд с 14:00, нет стойки 24/7 и нет багажа -> конфликт и предупреждение."""
    hotel = _make_dummy_hotel(has_24h=False, has_early=False, has_luggage=False)
    res = validate_arrival_checkin_match("07:00", hotel)
    assert res["has_conflict"] is True
    assert res["is_positive"] is False
    assert res["warning"] is not None
    assert "Камера хранения не подтверждена" in res["warning"]
    assert res["hours_difference"] == 7.0


def test_comfortable_daytime_arrival():
    hotel = _make_dummy_hotel()
    res = validate_arrival_checkin_match("15:30", hotel)
    assert res["has_conflict"] is False
    assert res["is_positive"] is True
    assert "идеально стыкуется" in res["evidence"]


def test_late_departure_with_late_checkout_service():
    hotel = _make_dummy_hotel(has_late=True)
    res = validate_departure_checkout_match("18:00", hotel)
    assert res["has_conflict"] is False
    assert res["is_positive"] is True
    assert res["status"] == "late_checkout_ready"
    assert "позднего выезда" in res["evidence"]


def test_late_departure_with_luggage_safeguard():
    hotel = _make_dummy_hotel(has_late=False, has_luggage=True)
    res = validate_departure_checkout_match("19:30", hotel)
    assert res["has_conflict"] is False
    assert res["is_positive"] is True
    assert res["status"] == "luggage_safeguard"
    assert "камеру хранения" in res["evidence"]


def test_late_departure_conflict_when_no_safeguards():
    hotel = _make_dummy_hotel(has_late=False, has_luggage=False, has_24h=False)
    res = validate_departure_checkout_match("18:30", hotel)
    assert res["has_conflict"] is True
    assert res["is_positive"] is False
    assert "Камера хранения не подтверждена" in res["warning"]
    assert res["hours_difference"] == 6.5


def test_early_morning_departure_with_24h_desk():
    hotel = _make_dummy_hotel(has_24h=True)
    res = validate_departure_checkout_match("06:30", hotel)
    assert res["has_conflict"] is False
    assert res["is_positive"] is True
    assert "круглосуточная стойка" in res["evidence"]


def test_comfortable_daytime_departure():
    hotel = _make_dummy_hotel()
    res = validate_departure_checkout_match("11:30", hotel)
    assert res["has_conflict"] is False
    assert res["is_positive"] is True
    assert "комфортно состыковано" in res["evidence"]


def test_departure_when_none():
    hotel = _make_dummy_hotel()
    res = validate_departure_checkout_match(None, hotel)
    assert res["has_conflict"] is False
    assert res["is_positive"] is True
    assert "выезда до 12:00" in res["evidence"]
