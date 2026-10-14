import time

from ..schemas.chat import ExtractedSlots


class SessionMemory:
    """
    Хранилище параметров сессии (Multi-turn Slot Merging).
    Позволяет агенту помнить город, даты, состав гостей и фильтры между репликами.
    """
    def __init__(self, ttl_seconds: int = 3600):
        self._store: dict[str, tuple[float, ExtractedSlots]] = {}
        self._ttl = ttl_seconds

    def get_slots(self, conversation_id: str) -> ExtractedSlots | None:
        if not conversation_id or conversation_id not in self._store:
            return None
        created_at, slots = self._store[conversation_id]
        if time.time() - created_at > self._ttl:
            del self._store[conversation_id]
            return None
        return slots.model_copy()

    def save_slots(self, conversation_id: str, slots: ExtractedSlots) -> None:
        if not conversation_id:
            return
        self._store[conversation_id] = (time.time(), slots.model_copy())

    def clear(self) -> None:
        self._store.clear()

session_memory = SessionMemory()

def merge_slots(prev: ExtractedSlots | None, current: ExtractedSlots) -> ExtractedSlots:
    """
    Слияние слотов предыдущего контекста с новыми параметрами:
    - Если пользователь явно сменил город (например, был в Москве, написал 'хочу в Сочи') -> сброс слотов на новый город.
    - Если в новом запросе город не указан (например, '5 звезд' или 'свободная отмена') -> сохраняем предыдущий город.
    - Накапливаем фильтры: звездность, цена, бассейн, спа, завтрак, питомцы, отмена.
    """
    if not prev:
        return current.model_copy()

    merged = prev.model_copy()

    # Проверяем явную смену города
    if current.city and current.city.lower() != (prev.city or "").lower():
        # Явная смена направления -> сбрасываем старые специфические фильтры
        return current.model_copy()

    # Сохраняем или обновляем город
    if current.city:
        merged.city = current.city

    # Обновляем числовые параметры при явном указании
    if current.stars is not None:
        merged.stars = current.stars
    if current.max_price_per_night_rub is not None:
        merged.max_price_per_night_rub = current.max_price_per_night_rub
    if current.min_rating is not None:
        merged.min_rating = current.min_rating
    if current.guests_count and current.guests_count != 2:
        merged.guests_count = current.guests_count
    if current.nights and current.nights != 2:
        merged.nights = current.nights

    # Булевы удобства: накапливаем
    if current.pet_friendly is not None:
        merged.pet_friendly = current.pet_friendly
    if current.heated_pool is not None:
        merged.heated_pool = current.heated_pool
    if current.spa is not None:
        merged.spa = current.spa
    if current.breakfast_included is not None:
        merged.breakfast_included = current.breakfast_included
    if current.free_cancellation is not None:
        merged.free_cancellation = current.free_cancellation

    # Семантический запрос: объединяем контекст
    if current.semantic_query:
        if prev.semantic_query and current.semantic_query.lower() not in prev.semantic_query.lower():
            merged.semantic_query = f"{prev.semantic_query} {current.semantic_query}"
        else:
            merged.semantic_query = current.semantic_query

    # Чипсы уточнения берем свежие
    if current.disambiguation_suggestions:
        merged.disambiguation_suggestions = current.disambiguation_suggestions

    return merged
