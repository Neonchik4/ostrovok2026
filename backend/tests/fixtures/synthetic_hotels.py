"""Synthetic in-memory hotels dataset for unit testing without local 57MB files."""

from app.schemas.hotel_models import (
    Amenities,
    CancellationPolicy,
    Coordinates,
    HotelFullSchema,
    LocationDetails,
    PetPolicy,
    PoiDistance,
    Policies,
    ReviewsSummary,
    RoomType,
)


def get_synthetic_test_hotels() -> list[HotelFullSchema]:
    """Генерирует детерминированный список тестовых отелей."""
    return [
        HotelFullSchema(
            id="test_hotel_sochi_pool_pet",
            name="Сочи Спа Резорт",
            city="Сочи",
            stars=5,
            area="Центральный",
            area_type="center",
            address="Курортный проспект, 100",
            min_price_per_night_rub=12000,
            rating=9.4,
            reviews_count=150,
            location_details=LocationDetails(
                distance_to_center_km=1.2,
                distance_to_beach_m=150,
                distance_to_ski_lift_m=None,
                nearest_metro_or_station="Вокзал Сочи",
                nearest_beaches=[PoiDistance(name="Центральный пляж", distance_m=150, category="beach")],
            ),
            amenities=Amenities(
                pet_friendly=True,
                heated_pool=True,
                outdoor_pool=True,
                spa=True,
                sauna=True,
                fast_wifi=True,
                free_parking=True,
                restaurant_on_site=True,
            ),
            policies=Policies(
                check_in_time="15:00",
                check_out_time="12:00",
                cancellation=CancellationPolicy(is_free_cancellation=True, free_cancellation_deadline_hours=48),
                pets=PetPolicy(allowed=True, max_weight_kg=15, deposit_rub=5000, daily_fee_rub=1500),
            ),
            room_types=[
                RoomType(
                    room_id="r1",
                    name="Люкс с видом на море",
                    price_per_night_rub=12000,
                    has_balcony=True,
                    has_kitchen=False,
                    breakfast_included=True,
                )
            ],
            reviews_summary=ReviewsSummary(
                score_cleanliness=9.6,
                score_location=9.5,
                positive_highlights=["Отличный теплый бассейн", "Приветливый персонал с собакой"],
            ),
            coordinates=Coordinates(lat=43.5855, lon=39.7231),
        ),
        HotelFullSchema(
            id="test_hotel_polyana_ski",
            name="Горный Пик Поляна",
            city="Красная Поляна",
            stars=4,
            area="Эсто-Садок",
            area_type="mountain",
            address="ул. Олимпийская, 5",
            min_price_per_night_rub=8500,
            rating=8.9,
            reviews_count=98,
            location_details=LocationDetails(
                distance_to_center_km=2.0,
                distance_to_beach_m=None,
                distance_to_ski_lift_m=200,
                nearest_metro_or_station="Роза Хутор",
                nearest_ski_lifts=[PoiDistance(name="Подъемник Олимпия", distance_m=200, category="ski_lift")],
            ),
            amenities=Amenities(
                pet_friendly=False,
                heated_pool=True,
                spa=True,
                sauna=True,
                ski_storage=True,
                free_parking=True,
            ),
            policies=Policies(
                check_in_time="14:00",
                check_out_time="12:00",
                cancellation=CancellationPolicy(is_free_cancellation=True, free_cancellation_deadline_hours=24),
                pets=PetPolicy(allowed=False),
            ),
            room_types=[
                RoomType(
                    room_id="r2",
                    name="Стандарт с видом на горы",
                    price_per_night_rub=8500,
                    has_balcony=True,
                    breakfast_included=True,
                )
            ],
            reviews_summary=ReviewsSummary(positive_highlights=["Близко к подъемнику", "Сушилка для лыж"]),
            coordinates=Coordinates(lat=43.6841, lon=40.2986),
        ),
        HotelFullSchema(
            id="test_hotel_moscow_center",
            name="Отель Москва Центр",
            city="Москва",
            stars=4,
            area="Тверской",
            area_type="center",
            address="Тверская ул., 12",
            min_price_per_night_rub=6500,
            rating=8.7,
            reviews_count=210,
            location_details=LocationDetails(
                distance_to_center_km=0.5,
                nearest_metro_or_station="Тверская",
            ),
            amenities=Amenities(fast_wifi=True, restaurant_on_site=True, gym=True),
            policies=Policies(),
            room_types=[RoomType(room_id="r3", name="Комфорт", price_per_night_rub=6500)],
            reviews_summary=ReviewsSummary(positive_highlights=["В шаге от Кремля"]),
            coordinates=Coordinates(lat=55.7558, lon=37.6173),
        ),
    ]
