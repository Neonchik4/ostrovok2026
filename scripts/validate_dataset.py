import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import json
from backend.app.schemas.hotel_models import HotelFullSchema

with open("outputs/hotels_dataset.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total hotels loaded: {len(data)}")
validated = 0
errors = []
for i, h in enumerate(data):
    try:
        obj = HotelFullSchema(**h)
        validated += 1
    except Exception as e:
        errors.append((i, h.get("name"), str(e)))

print(f"Validated: {validated}/{len(data)}")
if errors:
    print(f"Errors ({len(errors)}):")
    for err in errors[:5]:
        print(err)
else:
    print("ALL HOTELS 100% VALID!")
