"""Regenerate the committed test fixture catalogue.

The production dataset lives in a private Yandex Object Storage bucket, so a fresh
CI checkout cannot fetch it. This script distils a small, representative catalogue
that keeps filtering, budget-relaxation and multi-turn tests exercising real hotel
records.

Run from the repository root:

    python scripts/build_test_fixture.py                       # local outputs/hotels.json
    python scripts/build_test_fixture.py --from-s3             # download via dataset_loader
    python scripts/build_test_fixture.py --source /tmp/x.json  # explicit file

Only the fields the tests assert on are kept; guest-review prose is dropped, which
keeps the fixture small and avoids redistributing user-generated content.
"""

from __future__ import annotations

import argparse
import collections
import copy
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
DEFAULT_OUTPUT = BACKEND_DIR / "tests" / "fixtures" / "hotels.json"

# Enough hotels per city to keep city/price assertions meaningful without bloat.
PER_CITY = 8
# vector_store.init_dataset() refuses to load catalogues smaller than this.
MIN_CATALOGUE_SIZE = 100

# Fields the tests read. Anything else is dropped to keep the fixture lean.
KEPT_FIELDS = (
    "id",
    "name",
    "city",
    "stars",
    "area",
    "area_type",
    "address",
    "min_price_per_night_rub",
    "rating",
    "reviews_count",
    "location_details",
    "amenities",
    "room_types",
    "policies",
    "tags",
    "image_urls",
    "coordinates",
    "data_quality",
    "region_name",
    "country_name",
)

# Checks read the nightly price and capacity, not editorial room descriptions.
KEPT_ROOM_FIELDS = (
    "room_id",
    "name",
    "price_per_night_rub",
    "derived",
    "capacity",
    "breakfast_included",
    "available_rooms_count",
)

# Amenity flags are boolean with `False` defaults in HotelFullSchema, so omitted
# keys decode identically. Keep only the flags filtering and disambiguation read.
KEPT_AMENITIES = (
    "pet_friendly",
    "heated_pool",
    "outdoor_pool",
    "spa",
    "sauna",
    "ski_storage",
    "sea_view",
    "mountain_view",
    "breakfast_included_available",
)

# Pet free-text fields are never asserted on; the numeric policy fields are.
KEPT_PET_POLICY = (
    "allowed",
    "max_pets",
    "max_weight_kg",
    "deposit_rub",
    "daily_fee_rub",
)


def clip(text: str | None, limit: int) -> str:
    text = text or ""
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def trim_hotel(hotel: dict) -> dict:
    """Keep only asserted fields, and shrink the few nested payloads that are kept."""
    trimmed = {k: copy.deepcopy(v) for k, v in hotel.items() if k in KEPT_FIELDS}

    trimmed["image_urls"] = (trimmed.get("image_urls") or [])[:1]

    # Room images and editorial copy are never rendered in tests; keep pricing
    # and capacity only. One room type per hotel is enough for receipt maths.
    trimmed["room_types"] = [
        {k: v for k, v in room.items() if k in KEPT_ROOM_FIELDS}
        for room in (trimmed.get("room_types") or [])[:1]
    ]

    location = trimmed.get("location_details") or {}
    for poi in ("nearest_beaches", "nearest_ski_lifts", "nearest_subways"):
        location[poi] = (location.get(poi) or [])[:2]
    trimmed["location_details"] = location

    amenities = trimmed.get("amenities") or {}
    trimmed["amenities"] = {k: v for k, v in amenities.items() if k in KEPT_AMENITIES}

    policies = trimmed.get("policies") or {}
    pets = policies.get("pets") or {}
    policies["pets"] = {k: v for k, v in pets.items() if k in KEPT_PET_POLICY}
    trimmed["policies"] = policies

    trimmed["tags"] = (trimmed.get("tags") or [])[:6]
    trimmed["name"] = clip(trimmed.get("name"), 120)
    trimmed["address"] = clip(trimmed.get("address"), 160)
    return trimmed


def select_hotels(catalogue: list[dict], per_city: int = PER_CITY) -> list[dict]:
    by_city: dict[str, list[dict]] = collections.defaultdict(list)
    for hotel in catalogue:
        by_city[hotel["city"]].append(hotel)

    picked: list[dict] = []
    for _city, hotels in sorted(by_city.items()):
        hotels = sorted(hotels, key=lambda h: h["min_price_per_night_rub"])
        total = len(hotels)
        if total <= per_city:
            picked.extend(hotels)
            continue
        # Even spacing over the price range preserves cheap and premium variants.
        indices = [round(i * (total - 1) / (per_city - 1)) for i in range(per_city)]
        picked.extend(hotels[i] for i in dict.fromkeys(indices))

    # The multi-turn stream test depends on Moscow having free-cancellation hotels
    # and a five-star option; guarantee both survive the sampling.
    chosen = {h["id"] for h in picked}
    moscow = [h for h in catalogue if h["city"] == "Москва"]
    guarantees = [
        h
        for h in moscow
        if h.get("policies", {}).get("cancellation", {}).get("is_free_cancellation")
        and h["id"] not in chosen
    ][:2]
    guarantees += [h for h in moscow if h["stars"] == 5 and h["id"] not in chosen][:2]
    for hotel in guarantees:
        if hotel["id"] not in chosen:
            picked.append(hotel)
            chosen.add(hotel["id"])

    return picked


def load_source(args: argparse.Namespace) -> list[dict]:
    if args.from_s3:
        sys.path.insert(0, str(BACKEND_DIR))
        from dotenv import load_dotenv

        load_dotenv(REPO_ROOT / ".env")
        from app.services.dataset_loader import ensure_dataset_available

        path = ensure_dataset_available(
            target_path=args.source or str(REPO_ROOT / "outputs" / "hotels.json"),
            force=True,
        )
        return json.loads(Path(path).read_text(encoding="utf-8"))

    source = Path(args.source) if args.source else REPO_ROOT / "outputs" / "hotels.json"
    if not source.exists():
        raise SystemExit(f"Source catalogue not found: {source}")
    return json.loads(source.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", help="Explicit catalogue path (JSON array).")
    parser.add_argument("--from-s3", action="store_true", help="Download via dataset_loader.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Fixture destination.")
    args = parser.parse_args()

    catalogue = load_source(args)
    selected = select_hotels(catalogue)
    if len(selected) < MIN_CATALOGUE_SIZE:
        raise SystemExit(
            f"Fixture has {len(selected)} hotels; vector_store requires "
            f"at least {MIN_CATALOGUE_SIZE}."
        )

    fixture = [trim_hotel(h) for h in selected]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(fixture, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    size_kb = output.stat().st_size / 1024
    print(f"Wrote {len(fixture)} hotels ({len({h['city'] for h in fixture})} cities) to {output}")
    print(f"Fixture size: {size_kb:.0f} KB")


if __name__ == "__main__":
    main()
