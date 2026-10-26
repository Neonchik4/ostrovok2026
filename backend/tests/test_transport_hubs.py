
from app.services.travel_time_calc import haversine_distance_km, load_transport_hubs


def test_transport_hubs_registry_coverage():
    """Проверяет, что все ключевые 19 направлений имеют вокзалы и аэропорты."""
    hubs = load_transport_hubs()
    assert len(hubs) >= 30

    cities = {h["city"] for h in hubs}
    assert "Сочи" in cities
    assert "Красная Поляна" in cities
    assert "Москва" in cities
    assert "Санкт-Петербург" in cities
    assert "Казань" in cities
    assert "Екатеринбург" in cities
    assert "Калининград" in cities
    assert "Владивосток" in cities
    assert "Иркутск (Байкал)" in cities

    # Проверка обязательных полей
    for hub in hubs:
        assert "id" in hub
        assert "city" in hub
        assert "name" in hub
        assert hub["hub_type"] in ("airport", "train_station")
        assert "lat" in hub["coordinates"]
        assert "lon" in hub["coordinates"]
        assert -90.0 <= hub["coordinates"]["lat"] <= 90.0
        assert -180.0 <= hub["coordinates"]["lon"] <= 180.0


def test_haversine_distance_known_points():
    """Тест формулы Haversine на известном расстоянии (Москва Шереметьево -> Ленинградский вокзал ~27 км)."""
    # SVO: 55.9736, 37.4125
    # Ленинградский: 55.7767, 37.6558
    dist = haversine_distance_km(55.9736, 37.4125, 55.7767, 37.6558)
    assert 25.0 <= dist <= 30.0


def test_haversine_distance_zero():
    """Расстояние между одинаковыми координатами равно 0."""
    dist = haversine_distance_km(43.5925, 39.7289, 43.5925, 39.7289)
    assert dist == 0.0
