from typing import TypedDict, List, Optional, Dict, Any
from ..schemas.chat import ExtractedSlots, HotelCardWidget

class AgentState(TypedDict, total=False):
    user_message: str
    disambiguation_selection: Optional[str]
    conversation_id: Optional[str]
    slots: ExtractedSlots
    hotels: List[HotelCardWidget]
    answer_tokens: List[str]
    disambiguation_chips: List[str]
    current_thought: str
    errors: List[str]
