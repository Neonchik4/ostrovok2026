from pydantic import BaseModel, Field

from .hotel_models import RoomType


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
    total_rub: int
    is_free_cancellation: bool
    cancellation_deadline: str | None = None


class CriterionMatch(BaseModel):
    criterion: str
    status: str = Field(..., description="code_verified | semantic_match | relaxed_compromise")
    evidence: str
    is_positive: bool = True


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


class WidgetEvent(BaseModel):
    type: str = "hotel_grid"
    hotels: list[HotelCardWidget] = Field(default_factory=list)
    disambiguation_chips: list[str] = Field(default_factory=list)


class ExtractedSlots(BaseModel):
    city: str | None = None
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
    semantic_query: str = ""
    disambiguation_suggestions: list[str] = Field(default_factory=list)


class SearchTelemetry(BaseModel):
    engine: str = "ChromaDB (HNSW)"
    total_evaluated: int = 0
    total_in_region: int = 0
    scalar_matched: int = 0
    is_relaxed: bool = False
    top_score_pct: int = 0
    min_price_rub: int = 0
