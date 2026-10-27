import re
from typing import Any

from ..schemas.chat import HotelReviewSummary

ASPECT_KEYWORDS = {
    "food": ["завтрак", "шведский стол", "кофе", "омлет", "каша", "ресторан", "ужин", "еда", "выпечка", "блюд"],
    "sleep_quality": ["кровать", "матрас", "подушк", "тишин", "шумоизоляци", "тихий", "шум", "беруши", "выспались"],
    "location": ["вокзал", "центр", "метро", "море", "пляж", "подъемник", "набережная", "остановка", "пешком", "рядом"],
    "cleanliness": ["чисто", "уборк", "полотенц", "белье", "санузел", "ванн", "душ", "пыль", "пятн"],
    "service": ["персонал", "ресепшен", "администратор", "вежлив", "заселен", "горничн", "сервис", "помогли"],
    "amenities": ["бассейн", "спа", "сауна", "хаммам", "вайфай", "wifi", "лифт", "кондиционер", "вид", "панорамн", "балкон"],
}

FILLER_PREFIXES = [
    r"^\d+[\.\)]\s*",
    r"^В общем и целом,?\s*",
    r"^Короче говоря,?\s*",
    r"^Хочется сказать,?\s*",
    r"^Отдыхали с (семьей|мужем|женой|друзьями),?\s*",
    r"^Были проездом[^,]*,?\s*",
    r"^В целом,?\s*",
    r"^Что касается[^,]*,?\s*",
]


def split_into_sentences(text: str) -> list[str]:
    """Разбивает текст на предложения с нормализацией пунктуации и очисткой вводных слов."""
    if not text:
        return []
    normalized = re.sub(r"[\r\n]+", ". ", text)
    raw_sentences = re.split(r"(?<=[.!?])\s+", normalized)
    cleaned = []
    for s in raw_sentences:
        s = s.strip()
        for p in FILLER_PREFIXES:
            s = re.sub(p, "", s, flags=re.IGNORECASE).strip()
        if s and len(s) > 1:
            s = s[0].upper() + s[1:]
        s = s.rstrip(".")
        if 25 <= len(s) <= 180:
            cleaned.append(s)
    return cleaned


def detect_sentence_aspect(sentence: str) -> str | None:
    """Определяет тематический аспект предложения по ключевым словам."""
    s_lower = sentence.lower()
    for aspect, kws in ASPECT_KEYWORDS.items():
        if any(kw in s_lower for kw in kws):
            return aspect
    return None


def extract_deterministic_highlights(reviews: list[dict[str, Any]]) -> tuple[list[str], list[str], dict[str, int]]:
    """
    Детерминированный NLP экстрактор цитат:
    - Извлекает лучшие позитивные и негативные цитаты.
    - Диверсифицирует цитаты по аспектам.
    """
    aspect_counts: dict[str, int] = {k: 0 for k in ASPECT_KEYWORDS}
    pos_candidates: list[tuple[float, str, str | None]] = []
    neg_candidates: list[tuple[float, str, str | None]] = []
    seen_texts: set[str] = set()

    for r in reviews:
        plus = (r.get("plus") or "").strip()
        minus = (r.get("minus") or "").strip()

        if plus and plus != "-":
            for sent in split_into_sentences(plus):
                low = sent.lower()
                if low in seen_texts:
                    continue
                seen_texts.add(low)
                asp = detect_sentence_aspect(sent)
                if asp:
                    aspect_counts[asp] += 1
                score = 1.0 + (2.0 if asp else 0.0) + (1.5 if 45 <= len(sent) <= 120 else 0.0)
                if any(w in low for w in ["отличн", "прекрасн", "вкусн", "удобн", "чист", "шикарн", "понравил"]):
                    score += 1.0
                pos_candidates.append((score, sent, asp))

        if minus and minus != "-":
            for sent in split_into_sentences(minus):
                low = sent.lower()
                if low in seen_texts:
                    continue
                seen_texts.add(low)
                asp = detect_sentence_aspect(sent)
                if asp:
                    aspect_counts[asp] += 1
                score = 1.0 + (2.0 if asp else 0.0) + (1.5 if 40 <= len(sent) <= 130 else 0.0)
                if any(w in low for w in ["минус", "шум", "плох", "медлен", "неудобн", "тесн", "старо", "холодн"]):
                    score += 1.0
                neg_candidates.append((score, sent, asp))

    pos_candidates.sort(key=lambda x: x[0], reverse=True)
    neg_candidates.sort(key=lambda x: x[0], reverse=True)

    selected_pos: list[str] = []
    used_pos_aspects: set[str] = set()
    for _, sent, asp in pos_candidates:
        if asp and asp not in used_pos_aspects:
            selected_pos.append(sent)
            used_pos_aspects.add(asp)
            if len(selected_pos) >= 4:
                break
    if len(selected_pos) < 3:
        for _, sent, _ in pos_candidates:
            if sent not in selected_pos:
                selected_pos.append(sent)
                if len(selected_pos) >= 4:
                    break

    selected_neg: list[str] = []
    used_neg_aspects: set[str] = set()
    for _, sent, asp in neg_candidates:
        if asp and asp not in used_neg_aspects:
            selected_neg.append(sent)
            used_neg_aspects.add(asp)
            if len(selected_neg) >= 3:
                break
    if len(selected_neg) < 2:
        for _, sent, _ in neg_candidates:
            if sent not in selected_neg:
                selected_neg.append(sent)
                if len(selected_neg) >= 3:
                    break

    return selected_pos, selected_neg, aspect_counts


def build_hotel_review_summary(hotel: Any) -> HotelReviewSummary:
    """Формирует компактную структуру review_summary: rating, reviews_count, топ-3 плюса, топ-2 минуса."""
    rating = float(getattr(hotel, "rating", None) or (hotel.get("rating") if isinstance(hotel, dict) else 0.0) or 0.0)
    reviews_count = int(getattr(hotel, "reviews_count", None) or (hotel.get("reviews_count") if isinstance(hotel, dict) else 0) or 0)

    summary_obj = getattr(hotel, "reviews_summary", None) or (hotel.get("reviews_summary") if isinstance(hotel, dict) else None)
    pos_highlights: list[str] = []
    neg_highlights: list[str] = []

    if summary_obj:
        if hasattr(summary_obj, "positive_highlights"):
            pos_highlights = list(summary_obj.positive_highlights or [])
            neg_highlights = list(summary_obj.negative_highlights or [])
        elif isinstance(summary_obj, dict):
            pos_highlights = list(summary_obj.get("positive_highlights") or [])
            neg_highlights = list(summary_obj.get("negative_highlights") or [])

    top_reviews_raw = getattr(hotel, "top_reviews", None) or (hotel.get("top_reviews") if isinstance(hotel, dict) else None) or []
    if (not pos_highlights or not neg_highlights) and top_reviews_raw:
        reviews_for_extraction = []
        for tr in top_reviews_raw:
            if hasattr(tr, "model_dump"):
                reviews_for_extraction.append(tr.model_dump())
            elif isinstance(tr, dict):
                reviews_for_extraction.append(tr)
        if reviews_for_extraction:
            extracted_pos, extracted_neg, _ = extract_deterministic_highlights(reviews_for_extraction)
            if not pos_highlights:
                pos_highlights = extracted_pos
            if not neg_highlights:
                neg_highlights = extracted_neg

    cleaned_pos: list[str] = []
    for item in pos_highlights:
        sentences = split_into_sentences(str(item))
        cleaned_pos.extend(sentences if sentences else [str(item).strip()])

    cleaned_neg: list[str] = []
    for item in neg_highlights:
        sentences = split_into_sentences(str(item))
        cleaned_neg.extend(sentences if sentences else [str(item).strip()])

    # Топ-3 плюса и топ-2 минуса согласно ТЗ
    pros = [p for p in cleaned_pos if len(p) >= 15][:3]
    cons = [c for c in cleaned_neg if len(c) >= 15][:2]

    return HotelReviewSummary(
        rating=rating,
        reviews_count=reviews_count,
        pros=pros,
        cons=cons,
    )


def tag_hotel_reviews(hotel_data: dict[str, Any]) -> dict[str, Any]:
    """Обогащает отель лаконичными highlights и аспектной статистикой."""
    reviews = hotel_data.get("reviews") or []
    if not reviews:
        return hotel_data
    pos_h, neg_h, aspect_counts = extract_deterministic_highlights(reviews)
    summary = dict(hotel_data.get("reviews_summary") or {})
    if pos_h:
        summary["positive_highlights"] = pos_h
    if neg_h:
        summary["negative_highlights"] = neg_h
    summary["aspect_mentions"] = aspect_counts
    hotel_data["reviews_summary"] = summary
    return hotel_data
