"""Tests for database schema metadata and semantic document builder."""
from tests.fixtures.synthetic_hotels import get_synthetic_test_hotels

from app.db.repository import HotelRepository
from app.services.semantic_builder import build_hotel_semantic_document


def test_schema_metadata_structure():
    meta = HotelRepository.get_schema_metadata()
    assert "tables" in meta
    assert "relations" in meta

    table_names = [t["name"] for t in meta["tables"]]
    assert "hotels" in table_names
    assert "room_types" in table_names
    assert "hotel_amenities" in table_names
    assert "hotel_policies" in table_names
    assert "enrichment_proposals" in table_names
    assert "audit_hotel_snapshots" in table_names

    # Check relation keys
    fk_relations = meta["relations"]
    assert any(r["from_table"] == "room_types" and r["to_table"] == "hotels" for r in fk_relations)
    assert any(r["from_table"] == "audit_hotel_snapshots" and r["to_table"] == "enrichment_proposals" for r in fk_relations)


def test_semantic_builder_output():
    hotels = get_synthetic_test_hotels()
    sochi_hotel = hotels[0]
    doc = build_hotel_semantic_document(sochi_hotel)

    assert "Сочи Спа Резорт" in doc
    assert "5-звездочный отель" in doc
    assert "до моря и пляжа 150 метров" in doc
    assert "pet-friendly" in doc
    assert "подогреваемый бассейн" in doc
    assert "Люкс с видом на море" in doc
