"""
LLM Cascade Facade Service.
Предоставляет единую точку входа (Facade Pattern) для извлечения слотов,
генерации мыслей и стриминга ответов агента с сохранением 100% обратной совместимости.
Декомпозирован на:
- llm_client.py (сетевые вызовы моделей и каскад)
- slot_extractor.py (извлечение слотов, чипсы и fallback)
- thought_generator.py (потоковая генерация хода рассуждений)
- response_generator.py (генерация финального ответа агента)
- text_helpers.py (санитизация и склонение числительных)
"""

from .llm_client import get_cascade_models
from .response_generator import (
    SYSTEM_AGENT_PROMPT,
    build_deterministic_agent_response,
    generate_agent_response_stream,
)
from .slot_extractor import (
    SYSTEM_EXTRACTOR_PROMPT,
    default_chips,
    extract_slots_cascade,
    mock_extract_slots,
    sanitize_chips,
)
from .thought_generator import (
    SYSTEM_THINKING_PROMPT,
    build_deterministic_reasoning,
    think_stream,
)

# Сохранение обратной совместимости с существующими тестами и модулями
_get_cascade_models = get_cascade_models
_mock_extract_slots = mock_extract_slots
_sanitize_chips = sanitize_chips
_default_chips = default_chips
_build_deterministic_reasoning = build_deterministic_reasoning
_build_deterministic_agent_response = build_deterministic_agent_response

__all__ = [
    "extract_slots_cascade",
    "think_stream",
    "generate_agent_response_stream",
    "get_cascade_models",
    "mock_extract_slots",
    "sanitize_chips",
    "default_chips",
    "build_deterministic_reasoning",
    "build_deterministic_agent_response",
    "SYSTEM_EXTRACTOR_PROMPT",
    "SYSTEM_THINKING_PROMPT",
    "SYSTEM_AGENT_PROMPT",
    "_get_cascade_models",
    "_mock_extract_slots",
    "_sanitize_chips",
    "_default_chips",
    "_build_deterministic_reasoning",
    "_build_deterministic_agent_response",
]
