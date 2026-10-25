
from ..schemas.chat import CriterionMatch, ExtractedSlots, HotelCardWidget, SearchTelemetry
from ..schemas.hotel_models import HotelFullSchema, RoomType
from .logistics_validator import validate_arrival_checkin_match, validate_departure_checkout_match
from .receipt_calc import calculate_receipt
from .travel_time_calc import find_nearest_hubs_for_coords


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
    elif slots.candidate_cities and any(c.lower() in hotel.city.lower() for c in slots.candidate_cities):
        bonus += 4.0
    if slots.area_type and hotel.area_type == slots.area_type:
        bonus += 3.0
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

    # Бонусы за логистические состыковки (Issue #27)
    if slots.arrival_time:
        logistics = validate_arrival_checkin_match(slots.arrival_time, hotel)
        if logistics["is_positive"]:
            bonus += 3.5
        elif logistics["has_conflict"]:
            bonus -= 2.0

    if slots.departure_time:
        dep_logistics = validate_departure_checkout_match(slots.departure_time, hotel)
        if dep_logistics["is_positive"]:
            bonus += 3.5
        elif dep_logistics["has_conflict"]:
            bonus -= 2.0

    # Бонусы за близость к вокзалам и аэропортам (Issue #28)
    if hotel.coordinates:
        station, airport, _ = find_nearest_hubs_for_coords(hotel.city, hotel.coordinates.lat, hotel.coordinates.lon)
        if slots.near_station and station and station.distance_km <= 2.5:
            bonus += 4.0
        if slots.near_airport and airport and airport.distance_km <= 6.0:
            bonus += 3.0

    final_pct = int(round(base_score + bonus))
    return max(65, min(97, final_pct))

def matches_scalar_filters(hotel: HotelFullSchema, slots: ExtractedSlots) -> bool:
    """Проверяет жесткие скалярные фильтры для отеля."""
    if slots.city and slots.city.lower() not in hotel.city.lower():
        return False
    if not slots.city and slots.candidate_cities and not any(c.lower() in hotel.city.lower() for c in slots.candidate_cities):
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
    if slots.needs_24h_front_desk and not (hotel.has_24h_front_desk or hotel.amenities.has_24h_front_desk):
        return False
    if slots.max_distance_to_station_km and hotel.coordinates:
        station, _, _ = find_nearest_hubs_for_coords(hotel.city, hotel.coordinates.lat, hotel.coordinates.lon)
        if station and station.distance_km > slots.max_distance_to_station_km:
            return False
    return True

def evaluate_criteria_breakdown(
    hotel: HotelFullSchema,
    slots: ExtractedSlots,
    is_relaxed: bool = False
) -> tuple[list[CriterionMatch], str | None]:
    """
    Разбивает Match Score на конкретные подтверждённые критерии:
    - code_verified: жесткие факты из карточки отеля (цена, удобства, звёзды)
    - semantic_match: векторное соответствие контексту, атмосфере и отзывам
    - relaxed_compromise: вынужденное ослабление критерия при Smart Relaxation
    """
    breakdown: list[CriterionMatch] = []
    compromises: list[str] = []

    # 1. Город / Локация
    if slots.city:
        if slots.city.lower() in hotel.city.lower():
            breakdown.append(CriterionMatch(
                criterion="Локация",
                status="code_verified",
                evidence=f"{hotel.city} (совпадает с «{slots.city}»)",
                is_positive=True,
            ))
        else:
            status = "relaxed_compromise" if is_relaxed else "code_verified"
            breakdown.append(CriterionMatch(
                criterion="Локация",
                status=status,
                evidence=f"{hotel.city} (вместо «{slots.city}»)",
                is_positive=False,
            ))
            if is_relaxed:
                compromises.append(f"Другой город ({hotel.city})")

    # 2. Бюджет / Цена
    if slots.max_price_per_night_rub:
        if 0 < hotel.min_price_per_night_rub <= slots.max_price_per_night_rub:
            ev = f"{hotel.min_price_per_night_rub:,} ₽/ночь <= {slots.max_price_per_night_rub:,} ₽".replace(",", " ")
            breakdown.append(CriterionMatch(
                criterion="Бюджет",
                status="code_verified",
                evidence=ev,
                is_positive=True,
            ))
        elif hotel.min_price_per_night_rub > slots.max_price_per_night_rub:
            diff = hotel.min_price_per_night_rub - slots.max_price_per_night_rub
            status = "relaxed_compromise" if is_relaxed else "code_verified"
            ev = f"Превышение на {diff:,} ₽ ({hotel.min_price_per_night_rub:,} ₽ при лимите {slots.max_price_per_night_rub:,} ₽)".replace(",", " ")
            breakdown.append(CriterionMatch(
                criterion="Бюджет",
                status=status,
                evidence=ev,
                is_positive=False,
            ))
            if is_relaxed:
                compromises.append(f"Бюджет превышен на {diff:,} ₽".replace(",", " "))
        else:
            breakdown.append(CriterionMatch(
                criterion="Бюджет",
                status="code_verified",
                evidence="Цена уточняется при бронировании",
                is_positive=True,
            ))

    # 3. Питомцы
    if slots.pet_friendly:
        if hotel.amenities.pet_friendly:
            breakdown.append(CriterionMatch(
                criterion="Питомцы",
                status="code_verified",
                evidence="Размещение с животными разрешено",
                is_positive=True,
            ))
        else:
            status = "relaxed_compromise" if is_relaxed else "code_verified"
            breakdown.append(CriterionMatch(
                criterion="Питомцы",
                status=status,
                evidence="Размещение с животными не подтверждено",
                is_positive=False,
            ))
            if is_relaxed:
                compromises.append("Без подтверждения питомцев")

    # 4. Подогреваемый бассейн
    if slots.heated_pool:
        if hotel.amenities.heated_pool:
            breakdown.append(CriterionMatch(
                criterion="Бассейн",
                status="code_verified",
                evidence="Подогреваемый теплый бассейн в наличии",
                is_positive=True,
            ))
        else:
            status = "relaxed_compromise" if is_relaxed else "code_verified"
            breakdown.append(CriterionMatch(
                criterion="Бассейн",
                status=status,
                evidence="Подогреваемый бассейн не заявлен",
                is_positive=False,
            ))
            if is_relaxed:
                compromises.append("Без теплого бассейна")

    # 5. СПА
    if slots.spa:
        if hotel.amenities.spa:
            breakdown.append(CriterionMatch(
                criterion="СПА-центр",
                status="code_verified",
                evidence="СПА, сауна или банный комплекс в наличии",
                is_positive=True,
            ))
        else:
            status = "relaxed_compromise" if is_relaxed else "code_verified"
            breakdown.append(CriterionMatch(
                criterion="СПА-центр",
                status=status,
                evidence="СПА-комплекс отсутствует",
                is_positive=False,
            ))
            if is_relaxed:
                compromises.append("Без СПА")

    # 6. Звездность
    if slots.stars:
        if hotel.stars >= slots.stars:
            breakdown.append(CriterionMatch(
                criterion="Категория",
                status="code_verified",
                evidence=f"{hotel.stars}★ (запрошено от {slots.stars}★)",
                is_positive=True,
            ))
        else:
            status = "relaxed_compromise" if is_relaxed else "code_verified"
            breakdown.append(CriterionMatch(
                criterion="Категория",
                status=status,
                evidence=f"{hotel.stars}★ (ниже запрошенных {slots.stars}★)",
                is_positive=False,
            ))
            if is_relaxed:
                compromises.append(f"Категория {hotel.stars}★ вместо {slots.stars}★")

    # 7. Рейтинг
    if slots.min_rating:
        if hotel.rating >= slots.min_rating:
            breakdown.append(CriterionMatch(
                criterion="Рейтинг гостей",
                status="code_verified",
                evidence=f"{hotel.rating:.1f} из 10 (порог {slots.min_rating:.1f})",
                is_positive=True,
            ))
        else:
            status = "relaxed_compromise" if is_relaxed else "code_verified"
            breakdown.append(CriterionMatch(
                criterion="Рейтинг гостей",
                status=status,
                evidence=f"{hotel.rating:.1f} из 10 (ниже порога {slots.min_rating:.1f})",
                is_positive=False,
            ))
            if is_relaxed:
                compromises.append(f"Рейтинг {hotel.rating:.1f} < {slots.min_rating:.1f}")

    # 8. Семантический запрос / отзывы / атмосфера
    if slots.semantic_query:
        q_words = [w for w in slots.semantic_query.lower().split() if len(w) > 3]
        matched_tags = [t for t in hotel.tags if any(w in t.lower() for w in q_words)]
        if matched_tags:
            evidence_str = f"Семантически совпали теги: {', '.join(matched_tags[:3])}"
        else:
            evidence_str = f"Семантическое соответствие описанию и отзывам по теме «{slots.semantic_query}»"

        breakdown.append(CriterionMatch(
            criterion="Атмосфера и пожелания",
            status="semantic_match",
            evidence=evidence_str,
            is_positive=True,
        ))

    # 9. Состыковка времени прибытия и заселения (Issue #27)
    if slots.arrival_time:
        logistics = validate_arrival_checkin_match(slots.arrival_time, hotel)
        breakdown.append(CriterionMatch(
            criterion="Состыковка заезда",
            status="code_verified" if logistics["is_positive"] else ("relaxed_compromise" if is_relaxed else "code_verified"),
            evidence=logistics["evidence"],
            is_positive=logistics["is_positive"],
        ))
        if is_relaxed and logistics.get("warning"):
            compromises.append(logistics["warning"])

    if slots.departure_time:
        dep_logistics = validate_departure_checkout_match(slots.departure_time, hotel)
        breakdown.append(CriterionMatch(
            criterion="Состыковка выезда",
            status="code_verified" if dep_logistics["is_positive"] else ("relaxed_compromise" if is_relaxed else "code_verified"),
            evidence=dep_logistics["evidence"],
            is_positive=dep_logistics["is_positive"],
        ))
        if is_relaxed and dep_logistics.get("warning"):
            compromises.append(dep_logistics["warning"])

    # 10. Близость к вокзалу / аэропорту (Issue #28)
    if hotel.coordinates:
        station, airport, _ = find_nearest_hubs_for_coords(hotel.city, hotel.coordinates.lat, hotel.coordinates.lon)
        if slots.near_station or slots.max_distance_to_station_km:
            if station:
                max_d = slots.max_distance_to_station_km or 2.5
                is_close = station.distance_km <= max_d
                breakdown.append(CriterionMatch(
                    criterion="Близость к вокзалу",
                    status="code_verified" if is_close else ("relaxed_compromise" if is_relaxed else "code_verified"),
                    evidence=f"{station.name}: {station.distance_km} км ({station.travel_time_min} мин)",
                    is_positive=is_close,
                ))
                if is_relaxed and not is_close:
                    compromises.append(f"Удален от вокзала на {station.distance_km} км")
        if slots.near_airport:
            if airport:
                is_close = airport.distance_km <= 8.0
                breakdown.append(CriterionMatch(
                    criterion="Близость к аэропорту",
                    status="code_verified" if is_close else ("relaxed_compromise" if is_relaxed else "code_verified"),
                    evidence=f"{airport.name}: {airport.distance_km} км ({airport.taxi_time_min} мин)",
                    is_positive=is_close,
                ))
                if is_relaxed and not is_close:
                    compromises.append(f"Удален от аэропорта на {airport.distance_km} км")

    # Базовые подтверждения, если фильтров не было
    if not breakdown:
        breakdown.append(CriterionMatch(
            criterion="Рейтинг",
            status="code_verified",
            evidence=f"Оценка гостей {hotel.rating:.1f} ({hotel.reviews_count} отзывов)",
            is_positive=True,
        ))
        breakdown.append(CriterionMatch(
            criterion="Локация",
            status="code_verified",
            evidence=f"{hotel.city}, {hotel.area or 'центр'}",
            is_positive=True,
        ))

    primary_compromise = "; ".join(compromises) if (is_relaxed and compromises) else None
    return breakdown, primary_compromise

def build_hotel_card(
    hotel: HotelFullSchema,
    score: float,
    slots: ExtractedSlots,
    is_relaxed: bool = False,
    override_compromise: str | None = None
) -> HotelCardWidget:
    """Формирует карточку отеля с честным расчетом чека и разложением соответствия."""
    rooms = hotel.room_types
    guests = slots.guests_count or 2
    nights = slots.nights or 2
    pets = 1 if slots.pet_friendly else 0

    suitable_rooms = [
        r for r in rooms
        if (r.capacity.max_total_guests if r.capacity else 2) >= guests
    ]
    chosen_room = suitable_rooms[0] if suitable_rooms else (rooms[0] if rooms else None)

    # Поиск ближайших транспортных узлов (вокзал, аэропорт)
    station_hub, airport_hub, overall_hub = None, None, None
    if hotel.coordinates:
        station_hub, airport_hub, overall_hub = find_nearest_hubs_for_coords(
            hotel.city, hotel.coordinates.lat, hotel.coordinates.lon
        )

    # Проверка состыковки заезда
    logistics = validate_arrival_checkin_match(slots.arrival_time, hotel)
    arrival_warn = logistics.get("warning")

    # Расчет трансфера до отеля (туда-обратно)
    transfer_cost = 0
    transfer_note = None
    if overall_hub:
        transfer_cost = overall_hub.taxi_cost_rub * 2
        transfer_note = f"Трансфер туда-обратно от «{overall_hub.name}» (~{overall_hub.distance_km} км): {transfer_cost:,} ₽".replace(",", " ")

    receipt_target_room = chosen_room or RoomType(name="Стандартный номер", price_per_night_rub=hotel.min_price_per_night_rub)
    receipt = calculate_receipt(
        receipt_target_room,
        hotel.policies,
        nights,
        guests,
        pets,
        transfer_cost_rub=transfer_cost,
        transfer_note=transfer_note,
        arrival_warning=arrival_warn,
    )

    if score > 1.0:
        match_score_pct = int(round(score))
    else:
        match_score_pct = compute_calibrated_match_score(score, hotel, slots)

    match_score_pct = max(65, min(98, match_score_pct))

    breakdown, comp_note = evaluate_criteria_breakdown(hotel, slots, is_relaxed=is_relaxed)
    if override_compromise:
        comp_note = override_compromise

    checkin_val = hotel.checkin_from or hotel.policies.check_in_time or "14:00"
    checkout_val = hotel.checkout_until or hotel.policies.check_out_time or "12:00"
    has_24h_val = hotel.has_24h_front_desk or hotel.amenities.has_24h_front_desk
    has_early_val = hotel.has_early_checkin or hotel.amenities.has_early_checkin or hotel.policies.early_check_in_available
    has_late_val = getattr(hotel, "has_late_checkout", False) or hotel.policies.late_check_out_available
    has_luggage_val = hotel.has_luggage_storage or hotel.amenities.has_luggage_storage

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
        distance_to_ski_lift_m=hotel.location_details.distance_to_ski_lift_m,
        criteria_breakdown=breakdown,
        compromise_note=comp_note,
        checkin_from=checkin_val,
        checkout_until=checkout_val,
        has_24h_front_desk=has_24h_val,
        has_early_checkin=has_early_val,
        has_late_checkout=has_late_val,
        has_luggage_storage=has_luggage_val,
        nearest_hub=overall_hub,
        nearest_station=station_hub,
        nearest_airport=airport_hub,
        coordinates=hotel.coordinates,
    )

def search_in_memory_with_telemetry(dataset: list[HotelFullSchema], slots: ExtractedSlots) -> tuple[list[HotelCardWidget], SearchTelemetry]:
    """Детерминированный in-memory поиск и ранжирование отелей с подробной телеметрией."""
    if slots.city:
        total_in_region = sum(1 for h in dataset if slots.city.lower() in h.city.lower())
    elif slots.candidate_cities:
        total_in_region = sum(1 for h in dataset if any(c.lower() in h.city.lower() for c in slots.candidate_cities))
    else:
        total_in_region = len(dataset)
    scored_hotels: list[tuple[int, HotelFullSchema]] = []
    scalar_matched = 0

    for h in dataset:
        if not matches_scalar_filters(h, slots):
            continue
        scalar_matched += 1

        q_words = (slots.semantic_query or "").lower().split()
        tag_match = sum(1 for w in q_words if any(w in t.lower() for t in h.tags))
        raw_sim = 0.55 + min(0.30, tag_match * 0.08)

        score_pct = compute_calibrated_match_score(raw_sim, h, slots)
        scored_hotels.append((score_pct, h))

    scored_hotels.sort(key=lambda x: x[0], reverse=True)

    cards: list[HotelCardWidget] = []
    for score_pct, h in scored_hotels[:6]:
        cards.append(build_hotel_card(h, float(score_pct), slots))

    is_relaxed = False
    if not cards and dataset:
        cards = search_relaxed(dataset, slots)
        is_relaxed = True

    top_score = cards[0].match_score_pct if cards else 0
    min_price = min((c.min_price_per_night_rub for c in cards), default=0)

    telemetry = SearchTelemetry(
        engine="In-Memory Dataset",
        total_evaluated=len(dataset),
        total_in_region=total_in_region,
        scalar_matched=scalar_matched,
        is_relaxed=is_relaxed,
        top_score_pct=top_score,
        min_price_rub=min_price,
    )
    return cards, telemetry

def search_in_memory(dataset: list[HotelFullSchema], slots: ExtractedSlots) -> list[HotelCardWidget]:
    cards, _ = search_in_memory_with_telemetry(dataset, slots)
    return cards

def search_relaxed(dataset: list[HotelFullSchema], slots: ExtractedSlots) -> list[HotelCardWidget]:
    """
    Умное ослабление ограничений (Smart Relaxation):
    Если строгие фильтры не дали результатов, подбирает наилучшие альтернативы
    в том же городе/регионе, максимально удовлетворяющие остальным критериям.
    """
    candidates = []
    for h in dataset:
        if slots.city and slots.city.lower() not in h.city.lower():
            continue
        if not slots.city and slots.candidate_cities and not any(c.lower() in h.city.lower() for c in slots.candidate_cities):
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

    if not candidates and not slots.city:
        for h in dataset:
            score_val = 72
            if slots.pet_friendly and h.amenities.pet_friendly:
                score_val += 8
            if slots.heated_pool and h.amenities.heated_pool:
                score_val += 7
            candidates.append((score_val, h.min_price_per_night_rub, -float(h.rating), h))

    candidates.sort(key=lambda x: (-x[0], x[1], x[2]))

    cards: list[HotelCardWidget] = []
    for score_pct, _, _, h in candidates[:6]:
        cards.append(build_hotel_card(h, float(score_pct), slots, is_relaxed=True))
    return cards
