from pydantic import BaseModel, Field

from .hotel_models import Coordinates, RoomType


class ChatStreamRequest(BaseModel):
    message: str = Field(
        ..., description="Текстовый или расшифрованный голосовой запрос пользователя"
    )
    conversation_id: str | None = Field(default=None, description="Идентификатор диалога")
    disambiguation_selection: str | None = Field(
        default=None, description="Выбранный чипс быстрого уточнения"
    )
    nights: int | None = Field(default=2, description="Количество ночей")
    guests: int | None = Field(default=2, description="Количество гостей")
    pets: int | None = Field(default=0, description="Количество питомцев")


class ThoughtEvent(BaseModel):
    step: str
    text: str


class TokenEvent(BaseModel):
    content: str


class ReceiptBreakdown(BaseModel):
    nights: int
    price_per_night_rub: int
    base_accommodation_cost_rub: int
    pet_deposit_rub: int
    resort_tax_rub: int
    transfer_cost_rub: int = 0
    flight_ticket_rub: int = 0
    train_ticket_rub: int = 0
    transport_ticket_rub: int = 0
    ticket_price_per_person_rub: int = 0
    tickets_count: int = 1
    transport_type: str = "flight"  # flight | train
    transport_name: str | None = None
    total_rub: int
    total_with_transport_rub: int = 0
    is_free_cancellation: bool
    cancellation_deadline: str | None = None
    transfer_note: str | None = None
    arrival_warning: str | None = None

class NearestHub(BaseModel):
    hub_id: str
    name: str
    hub_type: str = "train_station"  # airport | train_station
    distance_km: float
    travel_time_min: int = 0
    taxi_time_min: int = 0
    taxi_cost_rub: int = 0

class FlightTicketOption(BaseModel):
    origin: str
    destination: str
    airline: str
    flight_number: str | None = None
    departure_at: str
    arrival_at: str | None = None
    price_rub: int
    booking_url: str
    duration_min: int | None = None
    is_direct: bool = True

class TrainTicketOption(BaseModel):
    origin: str
    destination: str
    train_number: str | None = None
    departure_at: str | None = None
    arrival_at: str | None = None
    price_from_rub: int
    booking_url: str

class TransportSummary(BaseModel):
    origin_city: str = "Москва"
    destination_city: str
    recommended_flight: FlightTicketOption | None = None
    cheapest_flight: FlightTicketOption | None = None
    recommended_train: TrainTicketOption | None = None
    arrival_time: str | None = None
    preferred_mode: str = "both"


class CriterionMatch(BaseModel):
    criterion: str
    status: str = Field(..., description="code_verified | semantic_match | relaxed_compromise")
    evidence: str
    is_positive: bool = True


class HotelReviewSummary(BaseModel):
    rating: float = 0.0
    reviews_count: int = 0
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)


class HotelCardWidget(BaseModel):
    id: str
    name: str
    city: str
    stars: int
    area: str
    area_type: str
    address: str | None = None
    rating: float
    reviews_count: int
    image_urls: list[str]
    match_score_pct: int
    tags: list[str]
    min_price_per_night_rub: int
    suitable_room: RoomType | None = None
    receipt: ReceiptBreakdown | None = None
    distance_to_beach_m: int | None = None
    distance_to_ski_lift_m: int | None = None
    criteria_breakdown: list[CriterionMatch] = Field(default_factory=list)
    compromise_note: str | None = None
    checkout_url: str | None = None
    checkin_from: str = "14:00"
    checkout_until: str = "12:00"
    has_24h_front_desk: bool = False
    has_early_checkin: bool = False
    has_luggage_storage: bool = False
    has_late_checkout: bool = False
    nearest_hub: NearestHub | None = None
    nearest_station: NearestHub | None = None
    nearest_airport: NearestHub | None = None
    coordinates: Coordinates | None = None
    review_summary: HotelReviewSummary | None = None

class WidgetEvent(BaseModel):
    type: str = "hotel_grid"
    hotels: list[HotelCardWidget] = Field(default_factory=list)
    disambiguation_chips: list[str] = Field(default_factory=list)
    transport_summary: TransportSummary | None = None


class ExtractedSlots(BaseModel):
    city: str | None = None
    candidate_cities: list[str] = Field(default_factory=list)
    thematic_category: str | None = None
    thematic_title: str | None = None
    area_type: str | None = None
    stars: int | None = None
    max_price_per_night_rub: int | None = None
    min_rating: float | None = None
    pet_friendly: bool | None = None
    heated_pool: bool | None = None
    spa: bool | None = None
    breakfast_included: bool | None = None
    free_cancellation: bool | None = None
    max_distance_to_beach_m: int | None = None
    max_distance_to_ski_lift_m: int | None = None
    guests_count: int | None = 2
    nights: int | None = 2
    arrival_time: str | None = None
    departure_time: str | None = None
    needs_early_checkin: bool | None = None
    needs_late_checkout: bool | None = None
    needs_24h_front_desk: bool | None = None
    needs_luggage_storage: bool | None = None
    near_station: bool | None = None
    near_airport: bool | None = None
    max_distance_to_station_km: float | None = None
    max_distance_to_airport_km: float | None = None
    origin_city: str | None = None
    total_trip_budget_rub: int | None = None
    depart_date: str | None = None
    include_flight: bool | None = None
    include_train: bool | None = None
    transport_preference: str | None = None
    semantic_query: str = ""
    disambiguation_suggestions: list[str] = Field(default_factory=list)
    intent: str = "search"
    is_review_inquiry: bool = False


class SearchTelemetry(BaseModel):
    engine: str = "ChromaDB (HNSW)"
    total_evaluated: int = 0
    total_in_region: int = 0
    scalar_matched: int = 0
    is_relaxed: bool = False
    top_score_pct: int = 0
    min_price_rub: int = 0
