
from app.services.travel_time_calc import (
    estimate_pedestrian_time_min,
    estimate_taxi_cost_rub,
    estimate_taxi_time_min,
    find_nearest_hubs_for_coords,
)


def test_estimate_times():
    assert estimate_pedestrian_time_min(0.0) == 0
    assert estimate_pedestrian_time_min(4.5) == 60
    assert estimate_pedestrian_time_min(1.5) == 20

    assert estimate_taxi_time_min(0.0) == 0
    assert estimate_taxi_time_min(0.5) == 4
    assert estimate_taxi_time_min(10.0) >= 15


def test_estimate_taxi_cost():
    cost_mow = estimate_taxi_cost_rub(10.0, "Москва")
    assert cost_mow >= 500

    cost_reg = estimate_taxi_cost_rub(5.0, "Казань")
    assert cost_reg >= 200


def test_find_nearest_hubs_sochi():
    """Тест поиска ближайших узлов для отеля в центре Сочи (у вокзала)."""
    # Координаты рядом с вокзалом Сочи: 43.5930, 39.7290
    station, airport, overall = find_nearest_hubs_for_coords("Сочи", 43.5930, 39.7290)

    assert station is not None
    assert "вокзал Сочи" in station.name
    assert station.distance_km < 1.0
    assert station.travel_time_min <= 15

    assert airport is not None
    assert "Сочи" in airport.name or "Адлер" in airport.name
    assert airport.distance_km > 20.0

    assert overall is not None
    assert overall.hub_id == station.hub_id
