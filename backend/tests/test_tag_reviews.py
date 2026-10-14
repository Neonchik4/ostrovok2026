import os
import sys
import pytest

# Ensure scripts dir is accessible for import
SCRIPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

from tag_reviews import (
    split_into_sentences,
    detect_sentence_aspect,
    extract_deterministic_highlights,
    tag_hotel_reviews,
)


def test_split_into_sentences_cleans_fillers_and_bounds():
    raw_text = "1. Завтраки очень вкусные и сытные! Отдыхали с семьей в июле. Номер был чистым и уютным, ежедневная уборка."
    sentences = split_into_sentences(raw_text)

    assert len(sentences) >= 2
    # Numbering and fillers removed
    assert not any(s.startswith("1.") for s in sentences)
    assert any("Завтраки очень вкусные" in s for s in sentences)
    assert any("Номер был чистым" in s for s in sentences)


def test_detect_sentence_aspect():
    assert detect_sentence_aspect("Шведский стол с горячим омлетом и круассанами") == "food"
    assert detect_sentence_aspect("Матрас жесткий, отличная шумоизоляция и тишина ночью") == "sleep_quality"
    assert detect_sentence_aspect("До станции метро и пляжа 5 минут пешком") == "location"
    assert detect_sentence_aspect("Ванная комната сияет чистотой, полотенца меняли ежедневно") == "cleanliness"
    assert detect_sentence_aspect("Администратор на ресепшен помог быстро заселиться") == "service"
    assert detect_sentence_aspect("Теплый бассейн и спа-комплекс с финской сауной") == "amenities"
    assert detect_sentence_aspect("Небо было облачным") is None


def test_extract_deterministic_highlights_diversification():
    reviews = [
        {
            "id": 1,
            "plus": "Завтрак великолепный, большой выбор свежей выпечки и каш. До пляжа всего 3 минуты пешком.",
            "minus": "Шум с улицы при открытых окнах. Лифт в часы пик ходит медленно.",
        },
        {
            "id": 2,
            "plus": "Кровать огромная и удобная, матрас мягкий, спалось отлично. Персонал очень вежливый и отзывчивый.",
            "minus": "Шампунь в неудобных одноразовых пакетиках.",
        },
    ]

    pos_h, neg_h, aspects = extract_deterministic_highlights(reviews)

    assert len(pos_h) >= 2
    assert len(neg_h) >= 2

    # Highlights should be concise (< 180 chars)
    for q in pos_h + neg_h:
        assert len(q) <= 180
        assert len(q) >= 25

    # Check aspect counters
    assert aspects["food"] >= 1
    assert aspects["location"] >= 1
    assert aspects["sleep_quality"] >= 1


def test_tag_hotel_reviews_structure():
    mock_hotel = {
        "id": "h123",
        "name": "Отель Тест",
        "reviews": [
            {
                "id": 101,
                "plus": "Отличный подогреваемый бассейн и сауна. Уборка номеров безупречная каждый день.",
                "minus": "Вайфай в номере периодически отключался.",
            }
        ],
        "reviews_summary": {},
    }

    tagged = tag_hotel_reviews(mock_hotel)
    summary = tagged["reviews_summary"]

    assert "positive_highlights" in summary
    assert len(summary["positive_highlights"]) > 0
    assert "negative_highlights" in summary
    assert len(summary["negative_highlights"]) > 0
    assert "aspect_mentions" in summary
    assert summary["aspect_mentions"]["amenities"] >= 1
