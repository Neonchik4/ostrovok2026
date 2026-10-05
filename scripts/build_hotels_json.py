"""
ETL-merge: собирает итоговый outputs/hotels.json из базового датасета
и реальных отзывов outputs/hotels/{id}.json.
Вырезает доказанную синтетику: review_snippets-шаблоны, константные
positive_highlights, unsplash-заглушки. Идемпотентный, без сети.
"""

import json
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("hotels_merge")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
BASE_PATH = os.path.join(ROOT_DIR, "outputs", "hotels_dataset.json")
SHARDS_DIR = os.path.join(ROOT_DIR, "outputs", "hotels")
OUTPUT_PATH = os.path.join(ROOT_DIR, "outputs", "hotels.json")
INVALID_PATH = os.path.join(ROOT_DIR, "outputs", "hotels_invalid.json")
STATS_PATH = os.path.join(ROOT_DIR, "outputs", "hotels_stats.json")

MIN_REVIEW_LEN = 50

# Доказанные маркеры синтетики (см. аудит: 1 уникальный набор на 2666,
# 19 city-шаблонов review_snippets, unsplash у 2 отелей).
_SYNTHETIC_HIGHLIGHTS = {"Чистота в номерах", "Вежливый персонал", "Удобное расположение"}
_SYNTHETIC_SNIPPET_PREFIX = "Отличный отель в "
_UNWANTED_IMG = ("unsplash",)


def _is_synthetic_text(text: str) -> bool:
    t = (text or "").strip()
    return t in _SYNTHETIC_HIGHLIGHTS or t.startswith(_SYNTHETIC_SNIPPET_PREFIX)


def strip_slop(hotel: dict) -> dict:
    """Удаляет синтетику из базовой записи, не трогая реальные поля."""
    h = dict(hotel)
    summary = dict(h.get("reviews_summary") or {})
    summary.pop("review_snippets", None)
    summary["positive_highlights"] = [
        q for q in (summary.get("positive_highlights") or []) if not _is_synthetic_text(q)
    ]
    summary["negative_highlights"] = [
        q for q in (summary.get("negative_highlights") or []) if not _is_synthetic_text(q)
    ]
    h["reviews_summary"] = summary
    h["image_urls"] = [
        u for u in (h.get("image_urls") or [])
        if u and not any(m in u for m in _UNWANTED_IMG)
    ]
    h.pop("reviews", None)
    return h


def _clean_top_reviews(reviews: list) -> list:
    top = []
    for r in reviews or []:
        plus = (r.get("plus") or "").strip().replace("\x00", "")
        minus = (r.get("minus") or "").strip().replace("\x00", "")
        if len(f"{plus} {minus}".strip()) < MIN_REVIEW_LEN:
            continue
        top.append({
            "author": (r.get("author") or "").strip().replace("\x00", ""),
            "date": (r.get("date") or "").strip()[:10],
            "rating": r.get("rating"),
            "plus": plus[:1000],
            "minus": minus[:1000],
            "room": (r.get("room") or "").strip().replace("\x00", "")[:200],
            "traveller_type": r.get("traveller_type") or "other",
        })
        if len(top) >= 5:
            break
    return top


def merge_hotel(base: dict, shard: dict | None) -> dict:
    """Накладывает реальные отзывы шарда на базовую запись."""
    h = dict(base)
    quality = dict(h.get("data_quality") or {})
    summary = dict(h.get("reviews_summary") or {})

    if not shard or not (shard.get("reviews") or shard.get("reviews_summary")):
        summary.update({
            "positive_highlights": [], "negative_highlights": [],
            "valid_reviews_count": 0, "traveller_distribution": {},
        })
        h["reviews_summary"] = summary
        h["top_reviews"] = []
        h["total_ostrovok_reviews"] = 0
        quality["has_real_reviews"] = False
        h["data_quality"] = quality
        return h

    shard_summary = shard.get("reviews_summary") or {}
    for key in ("score_cleanliness", "score_location", "score_service",
                "score_value_for_money", "score_wifi"):
        if shard_summary.get(key) is not None:
            summary[key] = shard_summary[key]
    summary["positive_highlights"] = [
        q for q in (shard_summary.get("positive_highlights") or []) if not _is_synthetic_text(q)
    ][:5]
    summary["negative_highlights"] = [
        q for q in (shard_summary.get("negative_highlights") or []) if not _is_synthetic_text(q)
    ][:3]
    summary["valid_reviews_count"] = int(shard_summary.get("valid_reviews_count") or 0)
    summary["traveller_distribution"] = shard_summary.get("traveller_distribution") or {}
    summary.pop("review_snippets", None)

    h["reviews_summary"] = summary
    h["top_reviews"] = _clean_top_reviews(shard.get("reviews"))
    h["total_ostrovok_reviews"] = int(shard.get("total_ostrovok_reviews") or len(shard.get("reviews") or []))
    quality["has_real_reviews"] = bool(h["top_reviews"]) or summary["valid_reviews_count"] > 0
    h["data_quality"] = quality
    return h


def main() -> None:
    with open(BASE_PATH, "r", encoding="utf-8") as f:
        base_hotels = json.load(f)
    logger.info(f"База: {len(base_hotels)} отелей из {BASE_PATH}")

    merged, invalid = [], []
    with_reviews = 0
    for h in base_hotels:
        clean = strip_slop(h)
        shard_path = os.path.join(SHARDS_DIR, f"{h.get('id')}.json")
        shard = None
        if os.path.exists(shard_path):
            try:
                with open(shard_path, "r", encoding="utf-8") as f:
                    shard = json.load(f)
            except Exception as e:
                logger.warning(f"Шард {h.get('id')}: {e}")
        try:
            from backend.app.schemas.hotel_models import HotelFullSchema  # noqa: E402
            obj = HotelFullSchema.model_validate(merge_hotel(clean, shard))
            merged.append(obj.model_dump())
            with_reviews += int(obj.data_quality.has_real_reviews)
        except Exception as e:
            invalid.append({"id": h.get("id"), "error": str(e)[:300]})

    merged.sort(key=lambda x: (x.get("city", ""), x.get("id", "")))
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    with open(INVALID_PATH, "w", encoding="utf-8") as f:
        json.dump(invalid, f, ensure_ascii=False, indent=2)

    by_city: dict = {}
    for h in merged:
        by_city[h.get("city", "?")] = by_city.get(h.get("city", "?"), 0) + 1
    stats = {"total": len(merged), "with_real_reviews": with_reviews,
             "without_reviews": len(merged) - with_reviews,
             "invalid": len(invalid), "by_city": by_city}
    with open(STATS_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    size_mb = round(os.path.getsize(OUTPUT_PATH) / (1024 * 1024), 2)
    logger.info(f"Готово: {len(merged)} в {OUTPUT_PATH} ({size_mb} МБ), "
                f"с отзывами {with_reviews}, invalid {len(invalid)}")


if __name__ == "__main__":
    main()
