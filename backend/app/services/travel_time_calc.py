import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..schemas.chat import NearestHub

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "transport_hubs.json"


@lru_cache(maxsize=1)
def load_transport_hubs() -> list[dict[str, Any]]:
    """Загружает реестр транспортных узлов (аэропорты и вокзалы)."""
    if not DATA_PATH.exists():
        return []
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Вычисляет дистанцию по большому кругу между двумя точками (в километрах).
    Детерминированная математика без внешних сервисов.
    """
    radius = 6371.0  # радиус Земли в км
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(radius * c, 2)


def estimate_pedestrian_time_min(distance_km: float) -> int:
    """Оценка времени пешком при средней скорости 4.5 км/ч."""
    if distance_km <= 0:
        return 0
    return max(1, int(round((distance_km / 4.5) * 60)))


def estimate_taxi_time_min(distance_km: float) -> int:
    """Оценка времени на такси с учетом светофоров и маневров (~35 км/ч)."""
    if distance_km <= 0:
        return 0
    if distance_km < 1.0:
        return 4
    return max(4, int(round((distance_km / 35.0) * 60)) + 3)


def estimate_taxi_cost_rub(distance_km: float, city: str = "") -> int:
    """Детерминированная оценка стоимости такси от транспортного узла."""
    base_boarding = 220 if "москв" in city.lower() or "петербург" in city.lower() else 170
    per_km = 45 if "москв" in city.lower() or "сочи" in city.lower() else 35
    total = base_boarding + int(round(distance_km * per_km))
    return max(200, total)


def find_nearest_hubs_for_coords(
    city: str, lat: float | None, lon: float | None
) -> tuple[NearestHub | None, NearestHub | None, NearestHub | None]:
    """
    Находит ближайший вокзал, ближайший аэропорт и общий ближайший узел.
    Возвращает (nearest_station, nearest_airport, nearest_overall).
    """
    if lat is None or lon is None:
        return None, None, None

    all_hubs = load_transport_hubs()
    city_lower = (city or "").lower()

    # Фильтруем узлы по городу с учетом смежных агломераций
    candidates = [
        h for h in all_hubs
        if h["city"].lower() in city_lower or city_lower in h["city"].lower()
    ]
    if "полян" in city_lower:
        candidates.extend([h for h in all_hubs if "сочи" in h["city"].lower() and h not in candidates])
    elif "зеленоградск" in city_lower:
        candidates.extend([h for h in all_hubs if "калининград" in h["city"].lower() and h not in candidates])
    elif "байкал" in city_lower:
        candidates.extend([h for h in all_hubs if "иркутск" in h["city"].lower() and h not in candidates])

    if not candidates:
        return None, None, None

    nearest_station: NearestHub | None = None
    min_station_dist = float("inf")

    nearest_airport: NearestHub | None = None
    min_airport_dist = float("inf")

    for hub in candidates:
        h_lat = hub["coordinates"]["lat"]
        h_lon = hub["coordinates"]["lon"]
        dist = haversine_distance_km(lat, lon, h_lat, h_lon)
        pedestrian_min = estimate_pedestrian_time_min(dist)
        taxi_min = estimate_taxi_time_min(dist)
        taxi_cost = estimate_taxi_cost_rub(dist, city)

        hub_obj = NearestHub(
            hub_id=hub["id"],
            name=hub["name"],
            hub_type=hub["hub_type"],
            distance_km=dist,
            travel_time_min=pedestrian_min if dist <= 2.5 else taxi_min,
            taxi_time_min=taxi_min,
            taxi_cost_rub=taxi_cost,
        )

        if hub["hub_type"] == "train_station" and dist < min_station_dist:
            min_station_dist = dist
            nearest_station = hub_obj
        elif hub["hub_type"] == "airport" and dist < min_airport_dist:
            min_airport_dist = dist
            nearest_airport = hub_obj

    # Выбираем ближайший общий узел
    overall: NearestHub | None = None
    if nearest_station and nearest_airport:
        overall = nearest_station if nearest_station.distance_km <= nearest_airport.distance_km else nearest_airport
    else:
        overall = nearest_station or nearest_airport

    return nearest_station, nearest_airport, overall
