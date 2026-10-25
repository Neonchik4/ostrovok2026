
from app.services.transfer_cost_calc import (
    calculate_transfer_breakdown,
    evaluate_transfer_tradeoff,
)


def test_calculate_transfer_breakdown():
    res = calculate_transfer_breakdown(10.0, "Сочи", round_trip=True)
    assert res["distance_km"] == 10.0
    assert res["one_way_cost_rub"] >= 400
    assert res["round_trip_cost_rub"] == res["one_way_cost_rub"] * 2
    assert "Трансфер туда-обратно" in res["transfer_note"]


def test_evaluate_transfer_tradeoff_eats_savings():
    """Тест: отель дешевле на 500 руб/ночь (1000 за 2 ночи), но такси стоит 1600 -> выгода съедена."""
    is_eaten, explanation, net_savings = evaluate_transfer_tradeoff(
        hotel_price_per_night=5000,
        central_hotel_price_per_night=5500,
        distance_to_hub_km=20.0,
        nights=2,
        city="Сочи",
    )
    assert is_eaten is True
    assert net_savings < 0
    assert explanation is not None
    assert "нивелирует выгоду" in explanation


def test_evaluate_transfer_tradeoff_real_savings():
    """Тест: отель дешевле на 3 000 руб/ночь (6000 за 2 ночи), такси стоит 1000 -> реальная чистая экономия."""
    is_eaten, explanation, net_savings = evaluate_transfer_tradeoff(
        hotel_price_per_night=4000,
        central_hotel_price_per_night=7000,
        distance_to_hub_km=8.0,
        nights=2,
        city="Казань",
    )
    assert is_eaten is False
    assert net_savings > 4000
    assert explanation is not None
    assert "чистая выгода" in explanation
