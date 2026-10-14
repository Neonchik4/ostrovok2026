from app.services.receipt_calc import calculate_receipt


def test_calculate_receipt_deterministic():
    room = {
        "room_id": "std_1",
        "price_per_night_rub": 5000
    }
    policies = {
        "cancellation": {
            "is_free_cancellation": True,
            "free_cancellation_deadline_hours": 48
        },
        "pets": {
            "allowed": True,
            "deposit_rub": 1500,
            "daily_fee_rub": 500
        }
    }
    
    # 3 ночи, 2 гостя, 1 питомец
    receipt = calculate_receipt(room, policies, nights=3, guests=2, pets=1)
    
    # 5000 * 3 = 15000
    assert receipt.base_accommodation_cost_rub == 15000
    # Депозит 1500 + (500 * 3 * 1) = 3000
    assert receipt.pet_deposit_rub == 3000
    # Курортный сбор 50 * 2 * 3 = 300
    assert receipt.resort_tax_rub == 300
    # Итого 15000 + 3000 + 300 = 18300
    assert receipt.total_rub == 18300
    assert receipt.is_free_cancellation is True
    assert receipt.cancellation_deadline is not None and "48" in receipt.cancellation_deadline

def test_calculate_receipt_no_pets():
    room = {"price_per_night_rub": 10000}
    policies = {"cancellation": {"is_free_cancellation": False}}
    
    receipt = calculate_receipt(room, policies, nights=2, guests=1, pets=0)
    
    assert receipt.base_accommodation_cost_rub == 20000
    assert receipt.pet_deposit_rub == 0
    assert receipt.resort_tax_rub == 100
    assert receipt.total_rub == 20100
    assert receipt.is_free_cancellation is False
