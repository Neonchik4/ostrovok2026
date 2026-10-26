from typing import Any

from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    lat: float
    lon: float


class PoiDistance(BaseModel):
    name: str
    distance_m: int
    category: str | None = None


class RoomCapacity(BaseModel):
    max_adults: int = 2
    max_children: int = 0
    max_total_guests: int = 2


class RoomType(BaseModel):
    room_id: str | None = None
    name: str
    price_per_night_rub: int
    derived: bool = False
    capacity: RoomCapacity | None = None
    bed_setup: str | None = None
    area_sqm: int | None = None
    has_balcony: bool | None = None
    has_kitchen: bool | None = None
    view: str | None = None
    breakfast_included: bool | None = None
    available_rooms_count: int | None = None
    cancellation_rule: str | None = None
    images: list[str] = Field(default_factory=list)


class LocationDetails(BaseModel):
    distance_to_center_km: float | None = None
    distance_to_beach_m: int | None = None
    distance_to_ski_lift_m: int | None = None
    nearest_metro_or_station: str | None = None
    distance_to_transport_m: int | None = None
    nearest_beaches: list[PoiDistance] = Field(default_factory=list)
    nearest_ski_lifts: list[PoiDistance] = Field(default_factory=list)
    nearest_subways: list[PoiDistance] = Field(default_factory=list)


class Amenities(BaseModel):
    pet_friendly: bool = False
    heated_pool: bool = False
    outdoor_pool: bool = False
    spa: bool = False
    sauna: bool = False
    fast_wifi: bool = True
    free_parking: bool = False
    paid_parking: bool = False
    restaurant_on_site: bool = False
    breakfast_included_available: bool = False
    gym: bool = False
    kids_club: bool = False
    coworking_zone: bool = False
    ski_storage: bool = False
    air_conditioning: bool = False
    kitchen: bool = False
    balcony: bool = False
    elevator: bool = False
    bar: bool = False
    conference_hall: bool = False
    laundry: bool = False
    transfer: bool = False
    room_service: bool = False
    sea_view: bool = False
    mountain_view: bool = False


class CancellationPolicy(BaseModel):
    is_free_cancellation: bool = False
    free_cancellation_deadline_hours: int = 24
    penalty_rub: int = 0


class PetPolicy(BaseModel):
    allowed: bool = False
    max_pets: int = 0
    max_weight_kg: int = 0
    deposit_rub: int = 0
    daily_fee_rub: int = 0
    allowed_types: list[str] = Field(default_factory=list)
    restrictions_note: str | None = None


class Policies(BaseModel):
    check_in_time: str = "14:00"
    check_out_time: str = "12:00"
    early_check_in_available: bool = False
    late_check_out_available: bool = False
    min_stay_nights: int = 1
    cancellation: CancellationPolicy = Field(default_factory=CancellationPolicy)
    pets: PetPolicy = Field(default_factory=PetPolicy)


class ReviewsSummary(BaseModel):
    score_cleanliness: float = 0.0
    score_location: float = 0.0
    score_service: float = 0.0
    score_value_for_money: float = 0.0
    score_wifi: float = 0.0
    positive_highlights: list[str] = Field(default_factory=list)
    negative_highlights: list[str] = Field(default_factory=list)
    valid_reviews_count: int = 0
    traveller_distribution: dict[str, float] = Field(default_factory=dict)


class TopReview(BaseModel):
    author: str = ""
    date: str = ""
    rating: float | None = None
    plus: str = ""
    minus: str = ""
    room: str = ""
    traveller_type: str = "other"


class DataQuality(BaseModel):
    has_real_reviews: bool = False
    has_real_prices: bool = True
    has_real_rating: bool = True
    rooms_derived: bool = True
    policies_derived: bool = True


class HotelFullSchema(BaseModel):
    id: str
    name: str
    city: str
    stars: int
    area: str
    area_type: str
    address: str
    min_price_per_night_rub: int
    rating: float
    reviews_count: int
    location_details: LocationDetails
    amenities: Amenities
    room_types: list[RoomType] = Field(default_factory=list)
    policies: Policies
    tags: list[str] = Field(default_factory=list)
    reviews_summary: ReviewsSummary
    description: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    coordinates: Coordinates | None = None
    top_reviews: list[TopReview] = Field(default_factory=list)
    total_ostrovok_reviews: int = 0
    data_quality: DataQuality = Field(default_factory=DataQuality)

    # Полнофункциональные поля Островка для боевой готовности
    master_id: int | None = None
    slug: str | None = None
    hotel_kind: str | None = "HOTEL"
    is_apart_like: bool = False
    is_guru_hotel: bool = False
    promo_cashback: Any | None = None
    ta_rating: float | None = None
    ta_num_reviews: int | None = None
    region_id: int | None = None
    region_name: str | None = None
    country_name: str = "Россия"
    country_code: str = "RU"
    search_region_center_distance_m: int | None = None
    checkout_url: str | None = None
