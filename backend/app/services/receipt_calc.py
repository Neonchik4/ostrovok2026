from typing import Union, Dict
from ..schemas.chat import ReceiptBreakdown
from ..schemas.hotel_models import RoomType, Policies

def calculate_receipt(
    room: Union[RoomType, Dict[str, object]],
    policies: Union[Policies, Dict[str, object]],
    nights: int = 2,
    guests: int = 2,
    pets: int = 0
) -> ReceiptBreakdown:
    """
    Строгий детерминированный расчет прозрачного чека без LLM.
    Соответствует анти-слоп регламенту Островка.
    """
    safe_nights = max(1, nights)
    safe_guests = max(1, guests)
    safe_pets = max(0, pets)
    
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
    total = base_cost + total_pet_cost + resort_tax
    deadline_text = f"Бесплатная отмена за {deadline_hours} ч до заезда" if is_free else "Невозвратный тариф"
    
    return ReceiptBreakdown(
        nights=safe_nights,
        price_per_night_rub=price_per_night,
        base_accommodation_cost_rub=base_cost,
        pet_deposit_rub=total_pet_cost,
        resort_tax_rub=resort_tax,
        total_rub=total,
        is_free_cancellation=is_free,
        cancellation_deadline=deadline_text
    )
