"""
Checkout Service: генерация прямых ссылок на чекаут и бронирование на Ostrovok.ru.
Строго детерминированный сервис без LLM.
"""

import re
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

from ..schemas.hotel_models import HotelFullSchema

CITY_SLUG_MAP: dict[str, str] = {
    "красная поляна": "krasnaya_polyana",
    "сочи": "sochi",
    "санкт-петербург": "st_petersburg",
    "москва": "moscow",
    "казань": "kazan",
    "калининград": "kaliningrad",
    "екатеринбург": "ekaterinburg",
    "нижний новгород": "nizhny_novgorod",
    "шерегеш": "sheregesh",
    "алтай": "altay",
    "иркутск (байкал)": "irkutsk",
    "байкал": "irkutsk",
    "иркутск": "irkutsk",
    "дагестан (махачкала)": "makhachkala",
    "махачкала": "makhachkala",
    "дагестан": "makhachkala",
    "карелия (петрозаводск)": "petrozavodsk",
    "петрозаводск": "petrozavodsk",
    "карелия": "petrozavodsk",
    "владивосток": "vladivostok",
    "анапа": "anapa",
    "геленджик": "gelendzhik",
    "зеленоградск": "zelenogradsk",
    "мурманск": "murmansk",
    "самара": "samara",
}

TRANSLIT_TABLE: dict[str, str] = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "yo",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "kh",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "shch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


def slugify(text: str) -> str:
    """Транслитерирует и форматирует строку в URL-безопасный slug."""
    if not text:
        return "hotel"
    lowered = text.lower().strip()
    transliterated = "".join(TRANSLIT_TABLE.get(ch, ch) for ch in lowered)
    cleaned = re.sub(r"[^a-z0-9]+", "_", transliterated).strip("_")
    return cleaned or "hotel"


def get_city_slug(city_name: str | None) -> str:
    """Возвращает канонический slug города для Ostrovok.ru."""
    if not city_name:
        return "russia"
    clean = city_name.strip().lower()
    if clean in CITY_SLUG_MAP:
        return CITY_SLUG_MAP[clean]
    for key, slug in CITY_SLUG_MAP.items():
        if key in clean or clean in key:
            return slug
    return slugify(city_name)


def get_default_dates() -> tuple[str, str]:
    """Возвращает даты по умолчанию: заезд через 7 дней, выезд через 9 дней (2 ночи)."""
    now = datetime.now(UTC).date()
    checkin = now + timedelta(days=7)
    checkout = now + timedelta(days=9)
    return checkin.strftime("%Y-%m-%d"), checkout.strftime("%Y-%m-%d")


def build_ostrovok_checkout_url(
    hotel: HotelFullSchema | Mapping[str, Any] | Any,
    checkin: str | None = None,
    checkout: str | None = None,
    guests: int = 2,
    room_id: str | None = None,
) -> str:
    """
    Генерирует прямую валидную ссылку на страницу чекаута и бронирования на Ostrovok.ru.
    Строгий детерминированный алгоритм без галлюцинаций.

    В датасете slug хранит путь локации ("russia/sochi"), поэтому при наличии
    master_id и id собирается канонический URL отеля
    /hotel/{slug}/mid{master_id}/{id}/ (как в getOstrovokBookingUrl на фронте).
    Location-слаг без master_id не допускается в путь — иначе задвоение сегментов.
    """
    if isinstance(hotel, HotelFullSchema):
        city = hotel.city
        name = hotel.name
        slug = hotel.slug
        master_id = getattr(hotel, "master_id", None)
        hotel_id = getattr(hotel, "id", None)
    elif isinstance(hotel, Mapping):
        city = str(hotel.get("city", ""))
        name = str(hotel.get("name", ""))
        slug = hotel.get("slug")
        master_id = hotel.get("master_id")
        hotel_id = hotel.get("id")
    else:
        city = getattr(hotel, "city", "")
        name = getattr(hotel, "name", "")
        slug = getattr(hotel, "slug", None)
        master_id = getattr(hotel, "master_id", None)
        hotel_id = getattr(hotel, "id", None)

    def _clean(value: Any) -> str:
        return str(value).strip().strip("/") if value and isinstance(value, str) else ""

    clean_slug = _clean(slug)
    clean_hotel_id = _clean(hotel_id)
    is_location_slug = "/" in clean_slug

    if not checkin or not checkout:
        def_in, def_out = get_default_dates()
        checkin = checkin or def_in
        checkout = checkout or def_out

    if guests is not None:
        try:
            safe_guests = max(1, min(20, int(guests)))
        except (ValueError, TypeError):
            safe_guests = 2
    else:
        safe_guests = 2

    params = [f"dates={checkin}-{checkout}", f"guests={safe_guests}"]

    if room_id:
        clean_room = str(room_id).strip()
        if clean_room:
            params.append(f"room={clean_room}")

    # Канонический URL карточки отеля: slug датасета — путь локации.
    if is_location_slug and master_id and clean_hotel_id:
        base_url = f"https://ostrovok.ru/hotel/{clean_slug}/mid{master_id}/{clean_hotel_id}/"
        return f"{base_url}?{'&'.join(params)}"

    # Fallback: страница поиска по городу. Location-слаг без master_id
    # в путь не подставляется — во избежание задвоения сегментов.
    city_slug = get_city_slug(city)
    hotel_slug = clean_slug if (clean_slug and not is_location_slug) else slugify(name)
    base_url = f"https://ostrovok.ru/hotel/russia/{city_slug}/{hotel_slug}/"
    return f"{base_url}?{'&'.join(params)}"
