"""
Zero-Config Offline Mode (Issue #46).

Детерминированный индикатор автономного режима работы агента.
При отсутствии GEMINI_API_KEYS или при авторизационном отказе внешнего API
сервис не падает, а переключается на локальный эвристический движок:
- слоты: regex-экстрактор (slot_extractor.mock_extract_slots);
- векторный поиск: локальный SentenceTransformer (vector_store);
- транспорт: детерминированный fallback (transport_service);
- ответ и ход мыслей: шаблонные генераторы (response_generator, thought_generator).

Process-local состояние: один воркер = одно состояние. Сброс только через
reset_offline_state() в тестах или при перезапуске процесса.
"""

OFFLINE_MODE_MESSAGE = "Демо-режим (автономный эвристический агент без внешних API)"

# Маркеры авторизационных отказов внешних API.
# Не пересекаются с таймаутами и 429: те обрабатываются каскадом отдельно.
_AUTH_ERROR_MARKERS = (
    "api key not valid",
    "api_key_invalid",
    "invalid api key",
    "api key expired",
    "unregistered",
    "permission denied",
    "unauthorized",
    "401",
    "403",
)

_dead_keys: set[str] = set()
_offline_latched: bool = False
_offline_reason: str | None = None
_note_shown: bool = False


def is_auth_error(error_text: str) -> bool:
    """Определяет, является ли ошибка внешнего API авторизационным отказом."""
    lowered = (error_text or "").lower()
    return any(marker in lowered for marker in _AUTH_ERROR_MARKERS)


def register_dead_key(key: str) -> None:
    """Исключает невалидный ключ из каскада на время жизни процесса."""
    _dead_keys.add(key)


def filter_live_keys(keys: list[str]) -> list[str]:
    """Возвращает только ключи, не помеченные как скомпрометированные."""
    return [k for k in keys if k not in _dead_keys]


def all_configured_keys_dead() -> bool:
    """True, если ключи сконфигурированы, но каждый отклонен внешним API."""
    from .llm_client import _get_api_keys

    keys = _get_api_keys()
    return bool(keys) and all(k in _dead_keys for k in keys)


def mark_offline(reason: str) -> None:
    """Фиксирует переход в автономный режим (односторонняя защелка)."""
    global _offline_latched, _offline_reason
    if not _offline_latched:
        print(f"[Offline Mode] Активация: {reason}")
    _offline_latched = True
    _offline_reason = reason


def is_offline_mode() -> bool:
    """True, если внешние API недоступны: ключей нет либо все отклонены."""
    if _offline_latched:
        return True
    from .llm_client import _get_api_keys

    keys = _get_api_keys()
    return not keys or all(k in _dead_keys for k in keys)


def get_offline_reason() -> str | None:
    """Причина активации автономного режима (для логов и диагностики)."""
    return _offline_reason


def note_offline_once() -> None:
    """Печатает уведомление о демо-режиме ровно один раз за жизнь процесса."""
    global _note_shown
    if not _note_shown:
        _note_shown = True
        print(f"[LLM Client] {OFFLINE_MODE_MESSAGE}: сетевые вызовы отключены.")


def reset_offline_state() -> None:
    """Только для тестов: сбрасывает process-local состояние режима."""
    global _offline_latched, _offline_reason, _note_shown
    _dead_keys.clear()
    _offline_latched = False
    _offline_reason = None
    _note_shown = False


__all__ = [
    "OFFLINE_MODE_MESSAGE",
    "all_configured_keys_dead",
    "filter_live_keys",
    "get_offline_reason",
    "is_auth_error",
    "is_offline_mode",
    "mark_offline",
    "note_offline_once",
    "register_dead_key",
    "reset_offline_state",
]
