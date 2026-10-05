"""
Чистые функции агрегации отзывов Ostrovok.ru: санитизация сырого текста,
фильтр коротких реплик (<50 символов), реальные метрики без выдуманных дефолтов.
Без сети и без побочек — покрыты тестами, переиспользуются ETL и мержем.
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

MIN_REVIEW_TEXT_LEN = 50


def clean_str(val: Optional[str]) -> str:
    """Санитизация сырого текста отзыва: null-байты и мусор вне промптов/JSON."""
    return (val or "").replace("\x00", "").strip()


def normalize_date(val: Optional[str]) -> str:
    """Приводит дату отзыва к YYYY-MM-DD; непарсящееся возвращает как есть (до 10 символов)."""
    s = (val or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return s
    for fmt in ("%d.%m.%Y", "%Y.%m.%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s[:10], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    m = re.search(r"\d{4}-\d{2}-\d{2}", s)
    return m.group(0) if m else s[:10]


def _avg_or_zero(scores: List[float]) -> float:
    if not scores:
        return 0.0
    # Оценки в API от 1 до 10, приводим к 5-балльной шкале Островка
    return round((sum(scores) / len(scores)) / 2.0, 1)


def extract_review_metrics(raw_reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Фильтрует отзывы по длине и рассчитывает реальные метрики на основе отзывов гостей."""
    valid_reviews = []
    clean_scores: List[float] = []
    loc_scores: List[float] = []
    service_scores: List[float] = []
    meal_scores: List[float] = []
    wifi_scores: List[float] = []
    traveller_counts: Dict[str, int] = {}

    pos_quotes = []
    neg_quotes = []

    for r in raw_reviews:
        plus = clean_str(r.get("review_plus") or r.get("reviewPlus"))
        minus = clean_str(r.get("review_minus") or r.get("reviewMinus"))
        text = clean_str(r.get("review_text") or r.get("reviewText"))
        combined_text = f"{plus} {minus} {text}".strip()

        # Фильтр насыщенности: отсекаем отзывы короче порога
        if len(combined_text) < MIN_REVIEW_TEXT_LEN:
            continue

        rating = r.get("rating")
        date_str = r.get("review_date") or r.get("reviewDate") or ""
        author = ""
        room_name = ""
        order_ctx = r.get("order_context") or r.get("orderContext") or {}
        if isinstance(order_ctx, dict):
            author = order_ctx.get("author_name") or ""
            room_name = order_ctx.get("author_room") or ""

        trav_type = r.get("traveller_type") or r.get("travellerType") or "other"
        traveller_counts[trav_type] = traveller_counts.get(trav_type, 0) + 1

        detailed = r.get("detailed") or {}
        if isinstance(detailed, dict):
            if detailed.get("cleanness"):
                clean_scores.append(float(detailed["cleanness"]))
            if detailed.get("location"):
                loc_scores.append(float(detailed["location"]))
            if detailed.get("services"):
                service_scores.append(float(detailed["services"]))
            if detailed.get("meal"):
                meal_scores.append(float(detailed["meal"]))
            if detailed.get("wifi"):
                wifi_scores.append(float(detailed["wifi"]))

        if len(plus) >= 40:
            pos_quotes.append(plus)
        if len(minus) >= 40:
            neg_quotes.append(minus)

        valid_reviews.append({
            "id": r.get("id"),
            "author": author,
            "date": normalize_date(date_str),
            "rating": rating,
            "plus": plus[:1000],
            "minus": minus[:1000],
            "room": room_name[:200],
            "traveller_type": trav_type,
        })

    # Ноль вместо выдуманного дефолта: отель без отзывов не притворяется оцененным.
    has_real = bool(valid_reviews)

    # Сортируем цитаты по информативности (длине)
    pos_quotes.sort(key=len, reverse=True)
    neg_quotes.sort(key=len, reverse=True)

    total_trav = sum(traveller_counts.values()) or 1
    traveller_stats = {k: round(v / total_trav, 2) for k, v in traveller_counts.items()}

    summary = {
        "score_cleanliness": _avg_or_zero(clean_scores),
        "score_location": _avg_or_zero(loc_scores),
        "score_service": _avg_or_zero(service_scores),
        "score_value_for_money": _avg_or_zero(meal_scores),
        "score_wifi": _avg_or_zero(wifi_scores),
        "positive_highlights": pos_quotes[:5],
        "negative_highlights": neg_quotes[:3],
        "valid_reviews_count": len(valid_reviews),
        "traveller_distribution": traveller_stats,
        "has_real_reviews": has_real,
    }

    return {
        "reviews": valid_reviews,
        "reviews_summary": summary,
    }
