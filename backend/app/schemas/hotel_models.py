from typing import Optional, List
from pydantic import BaseModel, Field

class RoomCapacity(BaseModel):
    max_adults: int = 2
    max_children: int = 0
    max_total_guests: int = 2

class RoomType(BaseModel):
    room_id: Optional[str] = None
    name: str
    price_per_night_rub: int
    capacity: Optional[RoomCapacity] = None
    bed_setup: Optional[str] = None
    area_sqm: Optional[int] = None
    has_balcony: Optional[bool] = None
    view: Optional[str] = None
    breakfast_included: Optional[bool] = None
    available_rooms_count: Optional[int] = None

class LocationDetails(BaseModel):
    distance_to_center_km: Optional[float] = None
    distance_to_beach_m: Optional[int] = None
    distance_to_ski_lift_m: Optional[int] = None
    nearest_metro_or_station: Optional[str] = None
    distance_to_transport_m: Optional[int] = None

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
    allowed_types: List[str] = Field(default_factory=list)
    restrictions_note: Optional[str] = None

class Policies(BaseModel):
    check_in_time: str = "14:00"
    check_out_time: str = "12:00"
    early_check_in_available: bool = False
    late_check_out_available: bool = False
    min_stay_nights: int = 1
    cancellation: CancellationPolicy = Field(default_factory=CancellationPolicy)
    pets: PetPolicy = Field(default_factory=PetPolicy)

class ReviewsSummary(BaseModel):
    score_cleanliness: float = 4.5
    score_location: float = 4.5
    score_service: float = 4.5
    positive_highlights: List[str] = Field(default_factory=list)
    negative_highlights: List[str] = Field(default_factory=list)

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
    room_types: List[RoomType] = Field(default_factory=list)
    policies: Policies
    tags: List[str] = Field(default_factory=list)
    reviews_summary: ReviewsSummary
    description: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
