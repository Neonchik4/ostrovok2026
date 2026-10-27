from app.schemas.chat import ExtractedSlots
from app.schemas.hotel_models import (
    Amenities,
    HotelFullSchema,
    LocationDetails,
    Policies,
    ReviewsSummary,
)
from app.services.checkout_service import (
    build_ostrovok_checkout_url,
    get_city_slug,
    get_default_dates,
    slugify,
)
from app.services.hotel_filters import build_hotel_card


def test_slugify():
    assert slugify("Гранд Отель Поляна") == "grand_otel_polyana"
    assert slugify("Radisson Blu Resort & Congress Centre") == "radisson_blu_resort_congress_centre"
    assert slugify("") == "hotel"


def test_get_city_slug():
    assert get_city_slug("Сочи") == "sochi"
    assert get_city_slug("Красная Поляна") == "krasnaya_polyana"
    assert get_city_slug("Санкт-Петербург") == "st_petersburg"
    assert get_city_slug("Москва") == "moscow"
    assert get_city_slug("Казань") == "kazan"
    assert get_city_slug("Неизвестный Город") == "neizvestnyy_gorod"


def test_build_ostrovok_checkout_url_full():
    hotel_dict = {
        "id": "polyana_1",
        "name": "Гранд Отель Поляна",
        "city": "Красная Поляна",
        "slug": "grand_hotel_polyana",
    }
    url = build_ostrovok_checkout_url(
        hotel=hotel_dict,
        checkin="2026-11-10",
        checkout="2026-11-15",
        guests=3,
        room_id="deluxe_twin",
    )
    assert url.startswith("https://ostrovok.ru/hotel/russia/krasnaya_polyana/grand_hotel_polyana/")
    assert "dates=2026-11-10-2026-11-15" in url
    assert "guests=3" in url
    assert "room=deluxe_twin" in url


def test_build_ostrovok_checkout_url_default_dates_and_guests():
    hotel_dict = {
        "id": "hotel_1",
        "name": "Отель Уют",
        "city": "Сочи",
    }
    url = build_ostrovok_checkout_url(hotel=hotel_dict)
    def_in, def_out = get_default_dates()
    assert f"dates={def_in}-{def_out}" in url
    assert "guests=2" in url
    assert url.startswith("https://ostrovok.ru/hotel/russia/sochi/otel_uyut/")


def test_build_ostrovok_checkout_url_clamping():
    hotel_dict = {"name": "Тест", "city": "Москва"}
    url_low = build_ostrovok_checkout_url(hotel=hotel_dict, guests=0)
    assert "guests=1" in url_low
    url_high = build_ostrovok_checkout_url(hotel=hotel_dict, guests=50)
    assert "guests=20" in url_high


def test_build_ostrovok_checkout_url_canonical_with_location_slug():
    """
    Реальный формат датасета: slug хранит путь локации ("russia/sochi"),
    а канонический URL отеля на Островке собирается как
    /hotel/{slug}/mid{master_id}/{id}/. Задвоение пути недопустимо.
    """
    hotel_dict = {
        "id": "8avenue_hotel",
        "name": "Отель 8Авеню 4* by Provence",
        "city": "Сочи",
        "slug": "russia/sochi",
        "master_id": 10595288,
    }
    url = build_ostrovok_checkout_url(
        hotel=hotel_dict,
        checkin="2026-11-03",
        checkout="2026-11-05",
        guests=2,
    )
    assert url == (
        "https://ostrovok.ru/hotel/russia/sochi/mid10595288/8avenue_hotel/"
        "?dates=2026-11-03-2026-11-05&guests=2"
    )
    assert "russia/sochi/russia" not in url


def test_build_ostrovok_checkout_url_location_slug_without_master_id():
    """
    Location-слаг без master_id не должен дублировать путь:
    используется транслитерированный слаг названия отеля.
    """
    hotel_dict = {
        "id": "some_hotel",
        "name": "Отель Уют",
        "city": "Сочи",
        "slug": "russia/sochi",
    }
    url = build_ostrovok_checkout_url(hotel=hotel_dict)
    assert url.startswith("https://ostrovok.ru/hotel/russia/sochi/otel_uyut/")
    assert "russia/sochi/russia" not in url


def test_build_hotel_card_has_checkout_url():
    hotel = HotelFullSchema(
        id="h_test",
        name="Radisson Сочи",
        city="Сочи",
        stars=5,
        area="Адлер",
        area_type="sea",
        address="Морской б-р, 1",
        min_price_per_night_rub=8500,
        rating=9.2,
        reviews_count=120,
        location_details=LocationDetails(),
        amenities=Amenities(heated_pool=True, pet_friendly=True),
        policies=Policies(),
        room_types=[],
        slug="radisson_sochi",
        reviews_summary=ReviewsSummary(),
    )
    slots = ExtractedSlots(city="Сочи", guests_count=2, nights=3)
    card = build_hotel_card(hotel, score=0.85, slots=slots)

    assert card.checkout_url is not None
    assert card.checkout_url.startswith("https://ostrovok.ru/hotel/russia/sochi/radisson_sochi/")
    assert "guests=2" in card.checkout_url
