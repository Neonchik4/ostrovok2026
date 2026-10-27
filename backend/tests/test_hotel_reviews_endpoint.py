from unittest.mock import patch

from fastapi.testclient import TestClient
from tests.fixtures.synthetic_hotels import get_synthetic_test_hotels

from app.main import app
from app.schemas.chat import ExtractedSlots
from app.services.hotel_filters import build_hotel_card


def test_hotel_details_endpoint_returns_reviews():
    synth_hotel = get_synthetic_test_hotels()[0]
    client = TestClient(app)

    with patch("app.api.hotels.get_hotel_by_id", return_value=synth_hotel):
        response = client.get(f"/api/hotels/{synth_hotel.id}")
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == synth_hotel.id
        assert "reviews" in data
        assert "top_reviews" in data
        assert isinstance(data["reviews"], list)
        assert len(data["reviews"]) > 0

        first_rev = data["reviews"][0]
        assert "id" in first_rev
        assert first_rev["id"] == f"{synth_hotel.id}_rev_1"
        assert "author" in first_rev
        assert "rating" in first_rev
        assert "plus" in first_rev
        assert "minus" in first_rev


def test_hotel_details_endpoint_not_found():
    client = TestClient(app)
    with patch("app.api.hotels.get_hotel_by_id", return_value=None):
        response = client.get("/api/hotels/non_existent_hotel_xyz")
        assert response.status_code == 404


def test_hotel_card_widget_populates_reviews():
    synth_hotel = get_synthetic_test_hotels()[0]
    slots = ExtractedSlots(city=synth_hotel.city)
    widget = build_hotel_card(synth_hotel, score=90.0, slots=slots)

    assert len(widget.reviews) > 0
    assert widget.reviews[0].id == f"{synth_hotel.id}_rev_1"
    assert widget.reviews[0].author == "Сергей"
