from collections.abc import Mapping
from typing import Any

from ..schemas.chat import ReceiptBreakdown
from ..schemas.hotel_models import Policies, RoomType


def calculate_receipt(
    room: RoomType | Mapping[str, Any],
    policies: Policies | Mapping[str, Any],
    nights: int = 2,
    guests: int = 2,
    pets: int = 0,
    transfer_cost_rub: int = 0,
    flight_ticket_rub: int = 0,
    train_ticket_rub: int = 0,
    tickets_count: int = 1,
    ticket_price_per_person_rub: int = 0,
    transport_type: str = "flight",
    transport_name: str | None = None,
    transfer_note: str | None = None,
    arrival_warning: str | None = None,
) -> ReceiptBreakdown:
    """
    Строгий детерминированный расчет прозрачного чека без LLM.
    Соответствует анти-слоп регламенту Островка.
    Включает расчет полной стоимости поездки (проживание + трансфер + транспорт).
    """
    safe_nights = max(1, nights)
    safe_guests = max(1, guests)
    safe_pets = max(0, pets)
    safe_transfer = max(0, transfer_cost_rub)
    safe_flight = max(0, flight_ticket_rub)
    safe_train = max(0, train_ticket_rub)
    
    # Извлечение цены за ночь
    if isinstance(room, RoomType):
        price_per_night = room.price_per_night_rub
    else:
        price_per_night = int(room.get("price_per_night_rub", 0)) # type: ignore
        
    base_cost = price_per_night * safe_nights
    
    # Извлечение политик для питомцев
    if isinstance(policies, Policies):
        deposit = policies.pets.deposit_rub if safe_pets > 0 else 0
        daily_fee = policies.pets.daily_fee_rub if safe_pets > 0 else 0
        is_free = policies.cancellation.is_free_cancellation
        deadline_hours = policies.cancellation.free_cancellation_deadline_hours
    else:
        pets_data = policies.get("pets", {})
        deposit = int(pets_data.get("deposit_rub", 0)) if (isinstance(pets_data, dict) and safe_pets > 0) else 0 # type: ignore
        daily_fee = int(pets_data.get("daily_fee_rub", 0)) if (isinstance(pets_data, dict) and safe_pets > 0) else 0 # type: ignore
        cancellation_data = policies.get("cancellation", {})
        is_free = bool(cancellation_data.get("is_free_cancellation", False)) if isinstance(cancellation_data, dict) else False # type: ignore
        deadline_hours = int(cancellation_data.get("free_cancellation_deadline_hours", 24)) if isinstance(cancellation_data, dict) else 24 # type: ignore

    total_pet_cost = deposit + (daily_fee * safe_nights * safe_pets)
    resort_tax = 50 * safe_guests * safe_nights
    total_hotel = base_cost + total_pet_cost + resort_tax
    active_transport_rub = safe_train if transport_type == "train" else (safe_flight if safe_flight > 0 else safe_train)
    total_with_transport = total_hotel + safe_transfer + active_transport_rub
    deadline_text = f"Бесплатная отмена за {deadline_hours} ч до заезда" if is_free else "Невозвратный тариф"
    
    return ReceiptBreakdown(
        nights=safe_nights,
        price_per_night_rub=price_per_night,
        base_accommodation_cost_rub=base_cost,
        pet_deposit_rub=total_pet_cost,
        resort_tax_rub=resort_tax,
        transfer_cost_rub=safe_transfer,
        flight_ticket_rub=safe_flight,
        train_ticket_rub=safe_train,
        transport_ticket_rub=active_transport_rub,
        ticket_price_per_person_rub=max(0, ticket_price_per_person_rub),
        tickets_count=max(1, tickets_count),
        transport_type=transport_type,
        transport_name=transport_name,
        total_rub=total_hotel,
        total_with_transport_rub=total_with_transport,
        is_free_cancellation=is_free,
        cancellation_deadline=deadline_text,
        transfer_note=transfer_note,
        arrival_warning=arrival_warning,
    )
