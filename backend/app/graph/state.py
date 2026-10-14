from typing import TypedDict

from ..schemas.chat import ExtractedSlots, HotelCardWidget


class AgentState(TypedDict, total=False):
    user_message: str
    disambiguation_selection: str | None
    conversation_id: str | None
    slots: ExtractedSlots
    hotels: list[HotelCardWidget]
    answer_tokens: list[str]
    disambiguation_chips: list[str]
    current_thought: str
    errors: list[str]
