import re
import time
from datetime import datetime, timedelta

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
        # Явная смена направления -> сбрасываем старые специфические фильтры отеля, но сохраняем маршрут и бюджет
        merged_new = current.model_copy()
        if not merged_new.origin_city and prev.origin_city:
            merged_new.origin_city = prev.origin_city
        if not merged_new.total_trip_budget_rub and prev.total_trip_budget_rub:
            merged_new.total_trip_budget_rub = prev.total_trip_budget_rub
        if not merged_new.transport_preference and prev.transport_preference:
            merged_new.transport_preference = prev.transport_preference
        return merged_new

    # Сохраняем или обновляем город и тематические направления
    if current.city:
        merged.city = current.city
        merged.candidate_cities = []
        merged.thematic_category = None
        merged.thematic_title = None
    elif current.thematic_category:
        merged.thematic_category = current.thematic_category
        merged.thematic_title = current.thematic_title
        if not prev.city:
            merged.candidate_cities = current.candidate_cities
            merged.area_type = current.area_type
            merged.city = None

    # Обновляем числовые параметры при явном указании
    if current.stars is not None:
        merged.stars = current.stars
    if current.max_price_per_night_rub is not None:
        merged.max_price_per_night_rub = current.max_price_per_night_rub
    if current.total_trip_budget_rub is not None:
        merged.total_trip_budget_rub = current.total_trip_budget_rub
    # Проверяем относительный сдвиг дат: 'на 2 дня позже', 'на день позже', 'на 2 дня раньше'
    m_shift = re.search(
        r"(?:на\s+)?(\d+|один|два|три)\s+(?:дн[яей]|дня|день)\s+(позже|раньше)",
        (current.semantic_query or "").lower(),
    )
    if m_shift and prev.depart_date:
        w = m_shift.group(1)
        w_map = {"один": 1, "два": 2, "три": 3}
        days_delta = w_map.get(w, int(w) if w.isdigit() else 1)
        if m_shift.group(2) == "раньше":
            days_delta = -days_delta
        try:
            prev_dt = datetime.strptime(prev.depart_date, "%Y-%m-%d")
            merged.depart_date = (prev_dt + timedelta(days=days_delta)).strftime("%Y-%m-%d")
        except Exception:
            pass
    elif current.depart_date is not None:
        merged.depart_date = current.depart_date
        if current.nights:
            merged.nights = current.nights

    if current.min_rating is not None:
        merged.min_rating = current.min_rating

    # Обновление гостей с сохранением при уточнениях
    query_lower = (current.semantic_query or "").lower()
    has_explicit_guests = bool(
        re.search(
            r"\b(?:двоих|вдвоем|двое|парой|один|соло|одного|одному|\d+\s*(?:человек\w*|гост\w*|взросл\w*|персон\w*))\b",
            query_lower,
        )
    )
    if current.guests_count and (current.guests_count != 2 or has_explicit_guests):
        merged.guests_count = current.guests_count

    # Обновление ночей с сохранением при уточнениях
    query_no_shift = re.sub(
        r"\b(?:на\s+)?(?:\d+|один|два|три)\s+(?:дн[яей]|дня|день)\s+(?:позже|раньше)\b",
        "",
        query_lower,
    )
    has_explicit_nights = bool(
        re.search(
            r"\b(?:\d+\s*(?:ноч\w*|дн\w*|сут\w*)|пару\s+дней|две\s+ночи|два\s+дня|недел\w*|выходн\w*|выхи)\b",
            query_no_shift,
        )
    )
    if current.nights and (current.nights != 2 or has_explicit_nights) and not m_shift:
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

    # Логистика и транспорт (Backend 1 & 2)
    if current.arrival_time:
        merged.arrival_time = current.arrival_time
    if current.departure_time:
        merged.departure_time = current.departure_time
    if current.needs_early_checkin is not None:
        merged.needs_early_checkin = current.needs_early_checkin
    if current.needs_late_checkout is not None:
        merged.needs_late_checkout = current.needs_late_checkout
    if current.needs_24h_front_desk is not None:
        merged.needs_24h_front_desk = current.needs_24h_front_desk
    if current.needs_luggage_storage is not None:
        merged.needs_luggage_storage = current.needs_luggage_storage
    if current.near_station is not None:
        merged.near_station = current.near_station
    if current.near_airport is not None:
        merged.near_airport = current.near_airport
    if current.max_distance_to_station_km is not None:
        merged.max_distance_to_station_km = current.max_distance_to_station_km
    if current.origin_city:
        merged.origin_city = current.origin_city
    if current.include_flight is not None:
        merged.include_flight = current.include_flight
    if current.include_train is not None:
        merged.include_train = current.include_train
    if current.transport_preference is not None:
        merged.transport_preference = current.transport_preference

    # Семантический запрос: объединяем контекст
    if current.semantic_query:
        if prev.semantic_query and current.semantic_query.lower() not in prev.semantic_query.lower():
            merged.semantic_query = f"{prev.semantic_query} {current.semantic_query}"
        else:
            merged.semantic_query = current.semantic_query

    # Чипсы уточнения берем свежие
    if current.disambiguation_suggestions:
        merged.disambiguation_suggestions = current.disambiguation_suggestions

    merged.intent = current.intent
    merged.is_review_inquiry = current.is_review_inquiry

    return merged
