from typing import Any

from .travel_time_calc import estimate_taxi_cost_rub


def calculate_transfer_breakdown(
    distance_km: float,
    city: str = "",
    round_trip: bool = True
) -> dict[str, Any]:
    """
    Детерминированный расчет трансфера от вокзала/аэропорта до отеля.
    Исключает галлюцинации LLM.
    """
    safe_dist = max(0.5, distance_km)
    one_way = estimate_taxi_cost_rub(safe_dist, city)
    total = one_way * 2 if round_trip else one_way

    return {
        "distance_km": round(safe_dist, 1),
        "one_way_cost_rub": one_way,
        "round_trip_cost_rub": total,
        "transfer_note": f"Трансфер туда-обратно (~{safe_dist} км): {total:,} ₽".replace(",", " ")
    }


def evaluate_transfer_tradeoff(
    hotel_price_per_night: int,
    central_hotel_price_per_night: int,
    distance_to_hub_km: float,
    nights: int = 2,
    city: str = ""
) -> tuple[bool, str | None, int]:
    """
    Сверяет: не съест ли трансфер всю экономию на отеле (Issue #35 ТЗ).
    Возвращает (is_eaten, explanation, net_savings_rub).
    """
    total_savings = (central_hotel_price_per_night - hotel_price_per_night) * max(1, nights)
    if total_savings <= 0:
        return False, None, total_savings

    transfer_info = calculate_transfer_breakdown(distance_to_hub_km, city, round_trip=True)
    round_trip_transfer = transfer_info["round_trip_cost_rub"]

    net_savings = total_savings - round_trip_transfer

    if net_savings <= 0:
        loss = abs(net_savings)
        explanation = (
            f"Отель на удалении дешевле на {total_savings:,} ₽ за {nights} ночи, "
            f"однако трансфер туда-обратно (~{round_trip_transfer:,} ₽) полностью нивелирует выгоду "
            f"(переплата составит {loss:,} ₽)"
        ).replace(",", " ")
        return True, explanation, net_savings
    else:
        explanation = (
            f"Экономия на проживании {total_savings:,} ₽ покрывает трансфер "
            f"(~{round_trip_transfer:,} ₽), чистая выгода: {net_savings:,} ₽"
        ).replace(",", " ")
        return False, explanation, net_savings
