
from app.schemas.hotel_models import Policies, RoomType
from app.services.receipt_calc import calculate_receipt


def test_calculate_receipt_hotel_only():
    room = RoomType(name="Стандарт", price_per_night_rub=5000)
    policies = Policies()
    receipt = calculate_receipt(room, policies, nights=2, guests=2, pets=0)

    assert receipt.nights == 2
    assert receipt.price_per_night_rub == 5000
    assert receipt.base_accommodation_cost_rub == 10000
    assert receipt.resort_tax_rub == 200
    assert receipt.transfer_cost_rub == 0
    assert receipt.flight_ticket_rub == 0
    assert receipt.total_rub == 10200
    assert receipt.total_with_transport_rub == 10200


def test_calculate_receipt_full_trip_with_transfer_and_flights():
    """Тест полного чека поездки: отель + питомец + курортный сбор + трансфер + авиабилеты."""
    room = RoomType(name="Люкс", price_per_night_rub=10000)
    policies = Policies()
    receipt = calculate_receipt(
        room=room,
        policies=policies,
        nights=3,
        guests=2,
        pets=0,
        transfer_cost_rub=1600,
        flight_ticket_rub=9600,
        transfer_note="Трансфер туда-обратно",
        arrival_warning=None,
    )

    assert receipt.nights == 3
    assert receipt.base_accommodation_cost_rub == 30000
    assert receipt.resort_tax_rub == 300
    assert receipt.total_rub == 30300
    assert receipt.transfer_cost_rub == 1600
    assert receipt.flight_ticket_rub == 9600
    # Итого с дорогой: 30 300 + 1 600 + 9 600 = 41 500
    assert receipt.total_with_transport_rub == 41500
    assert receipt.transfer_note == "Трансфер туда-обратно"
    assert receipt.arrival_warning is None


def test_calculate_receipt_full_trip_with_train():
    """Тест чека поездки на поезде: отель + трансфер + ж/д билет."""
    room = RoomType(name="Стандарт", price_per_night_rub=7500)
    policies = Policies()
    receipt = calculate_receipt(
        room=room,
        policies=policies,
        nights=2,
        guests=2,
        pets=0,
        transfer_cost_rub=954,
        train_ticket_rub=3600,
        transport_type="train",
        transport_name="011Э «Анапа — Москва»",
        transfer_note="Трансфер от вокзала",
    )

    assert receipt.nights == 2
    assert receipt.base_accommodation_cost_rub == 15000
    assert receipt.resort_tax_rub == 200
    assert receipt.total_rub == 15200
    assert receipt.train_ticket_rub == 3600
    assert receipt.flight_ticket_rub == 0
    assert receipt.transport_ticket_rub == 3600
    assert receipt.transport_type == "train"
    assert receipt.transport_name == "011Э «Анапа — Москва»"
    # Итого: 15 200 + 954 + 3 600 = 19 754
    assert receipt.total_with_transport_rub == 19754


def test_calculate_receipt_multiple_guests_train_tickets():
    """Тест чека поездки для 4 гостей: билеты на поезд считаются на всех 4 пассажиров."""
    room = RoomType(name="Семейный люкс", price_per_night_rub=14662)
    policies = Policies()
    single_ticket = 3600
    guests = 4
    total_tickets = single_ticket * guests  # 14 400 ₽

    receipt = calculate_receipt(
        room=room,
        policies=policies,
        nights=2,
        guests=guests,
        pets=0,
        transfer_cost_rub=858,
        train_ticket_rub=total_tickets,
        tickets_count=guests,
        ticket_price_per_person_rub=single_ticket,
        transport_type="train",
        transport_name="102М Двухэтажный",
        transfer_note="Трансфер от вокзала",
    )

    assert receipt.nights == 2
    assert receipt.base_accommodation_cost_rub == 29324
    # Курортный сбор: 50 ₽ * 4 чел * 2 ночи = 400 ₽
    assert receipt.resort_tax_rub == 400
    assert receipt.total_rub == 29724
    assert receipt.tickets_count == 4
    assert receipt.ticket_price_per_person_rub == 3600
    assert receipt.train_ticket_rub == 14400
    assert receipt.transport_ticket_rub == 14400
    # Итого: 29 724 (отель) + 858 (трансфер) + 14 400 (4 ж/д билета) = 44 982 ₽
    assert receipt.total_with_transport_rub == 44982

