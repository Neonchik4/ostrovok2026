from typing import List, Tuple
from ..schemas.chat import ExtractedSlots, HotelCardWidget
from ..schemas.hotel_models import HotelFullSchema, RoomType
from .receipt_calc import calculate_receipt

def compute_calibrated_match_score(raw_similarity: float, hotel: HotelFullSchema, slots: ExtractedSlots) -> int:
    """
    Качественная калибровка Match Score:
    1. raw_similarity: косинусное сходство (от 0.30 до 0.85)
    2. Плавная нормализация в базовый диапазон [62 .. 88]
    3. Дополнительные баллы за точные совпадения слотов:
       + город (+5)
       + питомцы (+4)
       + бассейн / спа (+3)
       + бюджет в лимите (+3.5)
       + высокий рейтинг гостей (+2)
    4. Итоговый процент: 65% .. 97%, без слипания на 50% или 99%.
    """
    sim = max(0.0, min(1.0, raw_similarity))
    norm = max(0.0, min(1.0, (sim - 0.30) / 0.55))
    base_score = 62.0 + norm * 26.0

    bonus = 0.0
    if slots.city and slots.city.lower() in hotel.city.lower():
        bonus += 5.0
    if slots.pet_friendly and hotel.amenities.pet_friendly:
        bonus += 4.0
    if slots.heated_pool and hotel.amenities.heated_pool:
        bonus += 3.0
    if slots.spa and hotel.amenities.spa:
        bonus += 2.5
    if slots.max_price_per_night_rub and hotel.min_price_per_night_rub <= slots.max_price_per_night_rub:
        bonus += 3.5
    if hotel.rating >= 9.0:
        bonus += 2.0
    elif hotel.rating >= 8.0:
        bonus += 1.0

    final_pct = int(round(base_score + bonus))
    return max(65, min(97, final_pct))

def matches_scalar_filters(hotel: HotelFullSchema, slots: ExtractedSlots) -> bool:
    """Проверяет жесткие скалярные фильтры для отеля."""
    if slots.city and slots.city.lower() not in hotel.city.lower():
        return False
    if slots.stars and hotel.stars < slots.stars:
        return False
    if slots.min_rating and hotel.rating < slots.min_rating:
        return False
    if slots.max_price_per_night_rub and hotel.min_price_per_night_rub > slots.max_price_per_night_rub:
        return False
    # Цена неизвестна (0 + data_quality.has_real_prices=false): бюджет подтвердить нельзя
    if slots.max_price_per_night_rub and hotel.min_price_per_night_rub <= 0:
        return False
    if slots.pet_friendly and not hotel.amenities.pet_friendly:
        return False
    if slots.heated_pool and not hotel.amenities.heated_pool:
        return False
    if slots.spa and not hotel.amenities.spa:
        return False
    return True

def build_hotel_card(hotel: HotelFullSchema, score: float, slots: ExtractedSlots) -> HotelCardWidget:
    """Формирует карточку отеля с честным расчетом чека."""
    rooms = hotel.room_types
    guests = slots.guests_count or 2
    nights = slots.nights or 2
    pets = 1 if slots.pet_friendly else 0

    suitable_rooms = [
        r for r in rooms
        if (r.capacity.max_total_guests if r.capacity else 2) >= guests
    ]
    chosen_room = suitable_rooms[0] if suitable_rooms else (rooms[0] if rooms else None)

    receipt_target_room = chosen_room or RoomType(name="Стандартный номер", price_per_night_rub=hotel.min_price_per_night_rub)
    receipt = calculate_receipt(receipt_target_room, hotel.policies, nights, guests, pets)

    if score > 1.0:
        match_score_pct = int(round(score))
    else:
        match_score_pct = compute_calibrated_match_score(score, hotel, slots)

    match_score_pct = max(65, min(98, match_score_pct))

    return HotelCardWidget(
        id=hotel.id,
        name=hotel.name,
        city=hotel.city,
        stars=hotel.stars,
        area=hotel.area,
        area_type=hotel.area_type,
        address=hotel.address,
        rating=float(hotel.rating),
        reviews_count=hotel.reviews_count,
        image_urls=hotel.image_urls,
        match_score_pct=match_score_pct,
        tags=hotel.tags[:4],
        min_price_per_night_rub=hotel.min_price_per_night_rub,
        suitable_room=chosen_room,
        receipt=receipt,
        distance_to_beach_m=hotel.location_details.distance_to_beach_m,
        distance_to_ski_lift_m=hotel.location_details.distance_to_ski_lift_m
    )

def search_in_memory(dataset: List[HotelFullSchema], slots: ExtractedSlots) -> List[HotelCardWidget]:
    """Детерминированный in-memory поиск и ранжирование отелей."""
    scored_hotels: List[Tuple[int, HotelFullSchema]] = []

    for h in dataset:
        if not matches_scalar_filters(h, slots):
            continue

        q_words = (slots.semantic_query or "").lower().split()
        tag_match = sum(1 for w in q_words if any(w in t.lower() for t in h.tags))
        raw_sim = 0.55 + min(0.30, tag_match * 0.08)

        score_pct = compute_calibrated_match_score(raw_sim, h, slots)
        scored_hotels.append((score_pct, h))

    scored_hotels.sort(key=lambda x: x[0], reverse=True)

    cards: List[HotelCardWidget] = []
    for score_pct, h in scored_hotels[:6]:
        cards.append(build_hotel_card(h, float(score_pct), slots))

    if not cards and dataset:
        cards = search_relaxed(dataset, slots)

    return cards

def search_relaxed(dataset: List[HotelFullSchema], slots: ExtractedSlots) -> List[HotelCardWidget]:
    """
    Умное ослабление ограничений (Smart Relaxation):
    Если строгие фильтры не дали результатов, подбирает наилучшие альтернативы
    в том же городе/регионе, максимально удовлетворяющие остальным критериям.
    """
    candidates = []
    for h in dataset:
        if slots.city and slots.city.lower() not in h.city.lower():
            continue

        match_pct = 70
        if slots.pet_friendly and h.amenities.pet_friendly:
            match_pct += 8
        if slots.heated_pool and h.amenities.heated_pool:
            match_pct += 7
        if slots.spa and h.amenities.spa:
            match_pct += 5
        if slots.stars and h.stars >= slots.stars:
            match_pct += 4

        if slots.max_price_per_night_rub and h.min_price_per_night_rub > slots.max_price_per_night_rub:
            diff = h.min_price_per_night_rub - slots.max_price_per_night_rub
            penalty = int(min(15, (diff / max(slots.max_price_per_night_rub, 1000)) * 10))
            match_pct -= penalty

        score_val = max(62, min(92, match_pct))
        candidates.append((score_val, h.min_price_per_night_rub, -float(h.rating), h))

    if not candidates:
        for h in dataset:
            score_val = 72
            if slots.pet_friendly and h.amenities.pet_friendly:
                score_val += 8
            if slots.heated_pool and h.amenities.heated_pool:
                score_val += 7
            candidates.append((score_val, h.min_price_per_night_rub, -float(h.rating), h))

    candidates.sort(key=lambda x: (-x[0], x[1], x[2]))

    cards: List[HotelCardWidget] = []
    for score_pct, _, _, h in candidates[:6]:
        cards.append(build_hotel_card(h, float(score_pct), slots))
    return cards
