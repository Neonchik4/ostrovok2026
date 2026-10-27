from fastapi.testclient import TestClient

from app.main import app
from app.schemas.chat import ExtractedSlots
from app.services.hotel_filters import build_hotel_card
from app.services.vector_store import get_hotel_by_id, init_dataset


def test_hotel_details_endpoint_returns_reviews():
    client = TestClient(app)
    response = client.get("/api/hotels/altaj_pelas_hotel")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == "altaj_pelas_hotel"
    assert "reviews" in data
    assert "top_reviews" in data
    assert isinstance(data["reviews"], list)
    assert len(data["reviews"]) > 0

    first_rev = data["reviews"][0]
    assert "id" in first_rev
    assert first_rev["id"] == "altaj_pelas_hotel_rev_1"
    assert "author" in first_rev
    assert "rating" in first_rev
    assert "plus" in first_rev
    assert "minus" in first_rev


def test_hotel_details_endpoint_not_found():
    client = TestClient(app)
    response = client.get("/api/hotels/non_existent_hotel_xyz")
    assert response.status_code == 404


def test_hotel_card_widget_populates_reviews():
    init_dataset()
    hotel = get_hotel_by_id("altaj_pelas_hotel")
    assert hotel is not None

    slots = ExtractedSlots(city="Алтай")
    widget = build_hotel_card(hotel, score=90.0, slots=slots)

    assert len(widget.reviews) > 0
    assert widget.reviews[0].id == "altaj_pelas_hotel_rev_1"
    assert widget.reviews[0].author == "Sergei"
