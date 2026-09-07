from typing import Optional, List
from pydantic import BaseModel, Field
from .hotel_models import RoomType

class ChatStreamRequest(BaseModel):
    message: str = Field(..., description="Текстовый или расшифрованный голосовой запрос пользователя")
    conversation_id: Optional[str] = Field(default=None, description="Идентификатор диалога")
    disambiguation_selection: Optional[str] = Field(default=None, description="Выбранный чипс быстрого уточнения")
    nights: Optional[int] = Field(default=2, description="Количество ночей")
    guests: Optional[int] = Field(default=2, description="Количество гостей")
    pets: Optional[int] = Field(default=0, description="Количество питомцев")

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
    cancellation_deadline: Optional[str] = None

class HotelCardWidget(BaseModel):
    id: str
    name: str
    city: str
    stars: int
    area: str
    area_type: str
    address: Optional[str] = None
    rating: float
    reviews_count: int
    image_urls: List[str]
    match_score_pct: int
    tags: List[str]
    min_price_per_night_rub: int
    suitable_room: Optional[RoomType] = None
    receipt: Optional[ReceiptBreakdown] = None
    distance_to_beach_m: Optional[int] = None
    distance_to_ski_lift_m: Optional[int] = None

class WidgetEvent(BaseModel):
    type: str = "hotel_grid"
    hotels: List[HotelCardWidget] = Field(default_factory=list)
    disambiguation_chips: List[str] = Field(default_factory=list)

class ExtractedSlots(BaseModel):
    city: Optional[str] = None
    area_type: Optional[str] = None
    stars: Optional[int] = None
    max_price_per_night_rub: Optional[int] = None
    min_rating: Optional[float] = None
    pet_friendly: Optional[bool] = None
    heated_pool: Optional[bool] = None
    spa: Optional[bool] = None
    breakfast_included: Optional[bool] = None
    free_cancellation: Optional[bool] = None
    max_distance_to_beach_m: Optional[int] = None
    max_distance_to_ski_lift_m: Optional[int] = None
    guests_count: Optional[int] = 2
    nights: Optional[int] = 2
    semantic_query: str = ""
    disambiguation_suggestions: List[str] = Field(default_factory=list)
