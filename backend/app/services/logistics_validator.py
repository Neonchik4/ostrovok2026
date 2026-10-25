import re
from typing import Any

from ..schemas.hotel_models import HotelFullSchema


def parse_time_to_minutes(time_str: str | None) -> int | None:
    """Парсит строку времени ("07:00", "7:30", "14:15", "08:00") в минуты от полуночи."""
    if not time_str:
        return None
    cleaned = time_str.strip().lower()
    m = re.search(r"(\d{1,2})[:.](\d{2})", cleaned)
    if m:
        hours = int(m.group(1))
        mins = int(m.group(2))
        if 0 <= hours < 24 and 0 <= mins < 60:
            return hours * 60 + mins

    m_hour = re.search(r"(\d{1,2})\s*(?:утра|час)", cleaned)
    if m_hour:
        h = int(m_hour.group(1))
        if 0 <= h < 24:
            return h * 60
    return None


def format_minutes_to_time(minutes: int) -> str:
    """Форматирует минуты от полуночи в строку HH:MM."""
    return f"{(minutes // 60) % 24:02d}:{minutes % 60:02d}"


def _get_hotel_logistics_props(hotel: HotelFullSchema | dict[str, Any]) -> dict[str, Any]:
    if isinstance(hotel, HotelFullSchema):
        return {
            "checkin_str": hotel.checkin_from or hotel.policies.check_in_time or "14:00",
            "checkout_str": hotel.checkout_until or hotel.policies.check_out_time or "12:00",
            "has_24h": bool(hotel.has_24h_front_desk or hotel.amenities.has_24h_front_desk),
            "has_early": bool(hotel.has_early_checkin or hotel.amenities.has_early_checkin or hotel.policies.early_check_in_available),
            "has_late": bool(getattr(hotel, "has_late_checkout", False) or hotel.policies.late_check_out_available),
            "has_luggage": bool(hotel.has_luggage_storage or hotel.amenities.has_luggage_storage),
        }
    amenities = hotel.get("amenities", {})
    policies = hotel.get("policies", {})
    return {
        "checkin_str": hotel.get("checkin_from") or policies.get("check_in_time", "14:00"),
        "checkout_str": hotel.get("checkout_until") or policies.get("check_out_time", "12:00"),
        "has_24h": bool(hotel.get("has_24h_front_desk") or (isinstance(amenities, dict) and amenities.get("has_24h_front_desk"))),
        "has_early": bool(hotel.get("has_early_checkin") or (isinstance(amenities, dict) and amenities.get("has_early_checkin")) or (isinstance(policies, dict) and policies.get("early_check_in_available"))),
        "has_late": bool(hotel.get("has_late_checkout") or (isinstance(policies, dict) and policies.get("late_check_out_available"))),
        "has_luggage": bool(hotel.get("has_luggage_storage") or (isinstance(amenities, dict) and amenities.get("has_luggage_storage"))),
    }


def validate_arrival_checkin_match(
    arrival_time_str: str | None,
    hotel: HotelFullSchema | dict[str, Any],
) -> dict[str, Any]:
    """Валидация состыковки прибытия и заселения в отель (Issue #27)."""
    if not arrival_time_str:
        return {
            "has_conflict": False,
            "status": "normal",
            "evidence": "Стандартное время заезда с 14:00",
            "is_positive": True,
            "warning": None,
            "hours_difference": 0.0,
        }

    arr_min = parse_time_to_minutes(arrival_time_str)
    if arr_min is None:
        return {
            "has_conflict": False,
            "status": "normal",
            "evidence": f"Время прибытия: {arrival_time_str}",
            "is_positive": True,
            "warning": None,
            "hours_difference": 0.0,
        }

    props = _get_hotel_logistics_props(hotel)
    checkin_str = props["checkin_str"]
    has_24h, has_early, has_luggage = props["has_24h"], props["has_early"], props["has_luggage"]

    checkin_min = parse_time_to_minutes(checkin_str) or (14 * 60)
    arr_formatted = format_minutes_to_time(arr_min)

    # 1. Раннее прибытие (до заселения, например рейс в 07:00, заезд в 14:00)
    if arr_min < checkin_min:
        hours_diff = round((checkin_min - arr_min) / 60.0, 1)
        if has_early:
            return {
                "has_conflict": False,
                "status": "early_checkin_ready",
                "evidence": f"Раннее прибытие ({arr_formatted}): доступна подтвержденная услуга раннего заезда",
                "is_positive": True,
                "warning": None,
                "hours_difference": hours_diff,
            }
        elif has_24h or has_luggage:
            facility = "круглосуточная стойка" if has_24h else "камера хранения багажа"
            return {
                "has_conflict": False,
                "status": "luggage_safeguard",
                "evidence": f"Раннее прибытие ({arr_formatted}): отель имеет {facility} (можно оставить вещи до {checkin_str})",
                "is_positive": True,
                "warning": None,
                "hours_difference": hours_diff,
            }
        else:
            return {
                "has_conflict": True,
                "status": "early_wait_risk",
                "evidence": f"Раннее прибытие ({arr_formatted}): заезд с {checkin_str}, стойка не 24/7 (ожидание ~{hours_diff} ч)",
                "is_positive": False,
                "warning": f"Прибытие в {arr_formatted}, а заезд с {checkin_str}. Камера хранения не подтверждена.",
                "hours_difference": hours_diff,
            }

    # 2. Позднее прибытие (после 22:00 или ночью)
    if arr_min >= 22 * 60 or arr_min < 5 * 60:
        if has_24h:
            return {
                "has_conflict": False,
                "status": "late_arrival_safe",
                "evidence": f"Поздний заезд ({arr_formatted}): стойка регистрации 24/7 примет в любое время",
                "is_positive": True,
                "warning": None,
                "hours_difference": 0.0,
            }
        else:
            return {
                "has_conflict": True,
                "status": "late_arrival_risk",
                "evidence": f"Поздний заезд ({arr_formatted}): стойка 24/7 не заявлена, требуется звонок администратору",
                "is_positive": False,
                "warning": f"Позднее прибытие в {arr_formatted}. Рекомендуется согласовать ночной заезд.",
                "hours_difference": 0.0,
            }

    # Стандартный комфортный дневной заезд (14:00 - 22:00)
    return {
        "has_conflict": False,
        "status": "comfortable",
        "evidence": f"Прибытие в {arr_formatted} идеально стыкуется со временем заезда ({checkin_str})",
        "is_positive": True,
        "warning": None,
        "hours_difference": 0.0,
    }


def validate_departure_checkout_match(
    departure_time_str: str | None,
    hotel: HotelFullSchema | dict[str, Any],
) -> dict[str, Any]:
    """Валидация состыковки времени отъезда/обратного рейса и выезда из отеля (check-out)."""
    props = _get_hotel_logistics_props(hotel)
    checkout_str = props["checkout_str"]
    has_24h, has_late, has_luggage = props["has_24h"], props["has_late"], props["has_luggage"]

    checkout_min = parse_time_to_minutes(checkout_str) or (12 * 60)
    checkout_formatted = format_minutes_to_time(checkout_min)

    if not departure_time_str:
        return {
            "has_conflict": False,
            "status": "normal",
            "evidence": f"Стандартный расчетный час выезда до {checkout_formatted}",
            "is_positive": True,
            "warning": None,
            "hours_difference": 0.0,
        }

    dep_min = parse_time_to_minutes(departure_time_str)
    if dep_min is None:
        return {
            "has_conflict": False,
            "status": "normal",
            "evidence": f"Время отправления: {departure_time_str}, выезд до {checkout_formatted}",
            "is_positive": True,
            "warning": None,
            "hours_difference": 0.0,
        }

    dep_formatted = format_minutes_to_time(dep_min)

    # 1. Поздний отъезд (отправление более чем на 1 час позже расчетного часа)
    if dep_min > checkout_min + 60:
        hours_diff = round((dep_min - checkout_min) / 60.0, 1)
        if has_late:
            return {
                "has_conflict": False,
                "status": "late_checkout_ready",
                "evidence": f"Поздний отъезд ({dep_formatted}): доступна услуга позднего выезда (check-out после {checkout_formatted})",
                "is_positive": True,
                "warning": None,
                "hours_difference": hours_diff,
            }
        elif has_luggage or has_24h:
            facility = "камеру хранения багажа" if has_luggage else "круглосуточную стойку"
            return {
                "has_conflict": False,
                "status": "luggage_safeguard",
                "evidence": f"Поздний отъезд ({dep_formatted}): отель имеет {facility} (вещи можно оставить после выезда в {checkout_formatted})",
                "is_positive": True,
                "warning": None,
                "hours_difference": hours_diff,
            }
        else:
            return {
                "has_conflict": True,
                "status": "late_departure_risk",
                "evidence": f"Поздний отъезд ({dep_formatted}): выезд до {checkout_formatted}, камера хранения не подтверждена (разрыв ~{hours_diff} ч)",
                "is_positive": False,
                "warning": f"Отправление в {dep_formatted}, а выезд до {checkout_formatted}. Камера хранения не подтверждена.",
                "hours_difference": hours_diff,
            }

    # 2. Ранний утренний выезд (до 08:00)
    if dep_min < 8 * 60:
        if has_24h:
            return {
                "has_conflict": False,
                "status": "early_departure_safe",
                "evidence": f"Ранний выезд ({dep_formatted}): круглосуточная стойка 24/7 оформит выезд в любое время",
                "is_positive": True,
                "warning": None,
                "hours_difference": 0.0,
            }
        else:
            return {
                "has_conflict": False,
                "status": "early_departure_notice",
                "evidence": f"Ранний выезд ({dep_formatted}): стойка 24/7 не заявлена, рекомендуется согласовать утренний выезд накануне",
                "is_positive": True,
                "warning": None,
                "hours_difference": 0.0,
            }

    # Комфортный дневной выезд
    return {
        "has_conflict": False,
        "status": "comfortable",
        "evidence": f"Время отъезда ({dep_formatted}) комфортно состыковано с расчетным часом выезда до {checkout_formatted}",
        "is_positive": True,
        "warning": None,
        "hours_difference": 0.0,
    }
