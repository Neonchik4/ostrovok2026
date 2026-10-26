import logging
from datetime import UTC, datetime, timedelta

import httpx

from ..config import settings
from ..schemas.chat import FlightTicketOption, TrainTicketOption, TransportSummary
from .location_registry import match_city

logger = logging.getLogger("transport_service")

# Сопоставление городов каталога с кодами IATA и вокзалов
CITY_IATA_MAP: dict[str, str] = {
    "москва": "MOW",
    "сочи": "AER",
    "красная поляна": "AER",
    "санкт-петербург": "LED",
    "казань": "KZN",
    "екатеринбург": "SVX",
    "калининград": "KGD",
    "нижний новгород": "GOJ",
    "шерегеш": "NOZ",
    "алтай": "RGK",
    "иркутск (байкал)": "IKT",
    "дагестан (махачкала)": "MCX",
    "карелия (петрозаводск)": "PES",
    "владивосток": "VVO",
    "анапа": "AAQ",
    "геленджик": "GDZ",
    "зеленоградск": "KGD",
    "мурманск": "MMK",
    "самара": "KUF",
    "ижевск": "IJK",
    "уфа": "UFA",
    "пермь": "PEE",
    "тюмень": "TJM",
    "челябинск": "CEK",
    "красноярск": "KJA",
    "новосибирск": "OVB",
    "омск": "OMS",
    "ростов-на-дону": "ROV",
    "волгоград": "VOG",
    "воронеж": "VOZ",
    "ярославль": "IAR",
    "саратов": "RTW",
}

CITY_TRAIN_MAP: dict[str, dict[str, str]] = {
    "москва": {"code": "2000000", "name": "Москва"},
    "сочи": {"code": "2064130", "name": "Сочи"},
    "красная поляна": {"code": "2064605", "name": "Роза Хутор"},
    "санкт-петербург": {"code": "2004001", "name": "Санкт-Петербург"},
    "казань": {"code": "2060600", "name": "Казань"},
    "екатеринбург": {"code": "2030000", "name": "Екатеринбург"},
    "калининград": {"code": "2058001", "name": "Калининград"},
    "нижний новгород": {"code": "2060001", "name": "Нижний Новгород"},
    "иркутск (байкал)": {"code": "2054001", "name": "Иркутск"},
    "дагестан (махачкала)": {"code": "2064010", "name": "Махачкала"},
    "карелия (петрозаводск)": {"code": "2004300", "name": "Петрозаводск"},
    "владивосток": {"code": "2034001", "name": "Владивосток"},
    "анапа": {"code": "2064188", "name": "Анапа"},
    "самара": {"code": "2024001", "name": "Самара"},
    "ижевск": {"code": "2060150", "name": "Ижевск"},
    "уфа": {"code": "2040000", "name": "Уфа"},
    "пермь": {"code": "2000002", "name": "Пермь-2"},
    "тюмень": {"code": "2054000", "name": "Тюмень"},
    "челябинск": {"code": "2040700", "name": "Челябинск"},
    "красноярск": {"code": "2038001", "name": "Красноярск"},
    "новосибирск": {"code": "2044001", "name": "Новосибирск"},
    "омск": {"code": "2044010", "name": "Омск"},
    "ростов-на-дону": {"code": "2064000", "name": "Ростов-Главный"},
    "волгоград": {"code": "2014000", "name": "Волгоград-1"},
    "воронеж": {"code": "2014001", "name": "Воронеж-1"},
    "ярославль": {"code": "2010001", "name": "Ярославль-Главный"},
    "саратов": {"code": "2020000", "name": "Саратов-1"},
}

AIRLINE_NAMES: dict[str, str] = {
    "SU": "Аэрофлот",
    "S7": "S7 Airlines",
    "DP": "Победа",
    "U6": "Уральские авиалинии",
    "UT": "ЮТэйр",
    "WZ": "Red Wings",
    "A4": "Азимут",
    "FV": "Россия",
    "N4": "Nordwind",
}


def _get_iata(city_name: str) -> str | None:
    canonical = match_city(city_name)
    c = (canonical or city_name or "").lower().strip()
    for k, v in CITY_IATA_MAP.items():
        if k in c or c in k:
            return v
    return None


def _get_train_info(city_name: str, default_code: str = "2064130") -> dict[str, str]:
    canonical = match_city(city_name)
    c = (canonical or city_name or "").lower().strip()
    for k, v in CITY_TRAIN_MAP.items():
        if k in c or c in k:
            return v
    return {"code": default_code, "name": canonical or city_name}


def _get_train_number(origin: str, destination: str) -> str:
    o, d = origin.lower(), destination.lower()
    if ("москва" in o and "сочи" in d) or ("сочи" in o and "москва" in d) or ("полян" in d):
        return "102М Двухэтажный"
    if ("петербург" in o and "москва" in d) or ("москва" in o and "петербург" in d):
        return "755А «Сапсан»"
    if ("казань" in o and "москва" in d) or ("москва" in o and "казань" in d):
        return "002Г «Премиум»"
    if "анапа" in o or "анапа" in d:
        return "011Э «Анапа — Москва»"
    if "нижний" in o or "нижний" in d:
        return "701Н «Ласточка»"
    if "самара" in o or "самара" in d:
        return "009Й «Жигули»"
    return f"Поезд {origin} — {destination}"


def _build_aviasales_link(origin: str, dest: str, depart_date: str) -> str:
    """Генерация прямой ссылки на Aviasales с партнерским маркером."""
    try:
        dt = datetime.strptime(depart_date[:10], "%Y-%m-%d")
        date_slug = dt.strftime("%d%m")
    except Exception:
        tomorrow = datetime.now(UTC) + timedelta(days=1)
        date_slug = tomorrow.strftime("%d%m")
    return f"https://www.aviasales.ru/search/{origin}{date_slug}{dest}1?marker=ostrovok2026"


def _build_tutu_link(origin_code: str, dest_code: str, depart_date: str) -> str:
    """Генерация прямой ссылки на Tutu.ru Ж/Д билеты с расписанием и покупкой."""
    try:
        dt = datetime.strptime(depart_date[:10], "%Y-%m-%d")
        date_fmt = dt.strftime("%d.%m.%Y")
    except Exception:
        tomorrow = datetime.now(UTC) + timedelta(days=1)
        date_fmt = tomorrow.strftime("%d.%m.%Y")
    return f"https://www.tutu.ru/poezda/rasp_d.php?nnst1={origin_code}&nnst2={dest_code}&date={date_fmt}"


async def search_transport_options(
    origin_city: str = "Москва",
    destination_city: str = "Сочи",
    depart_date: str | None = None,
    preferred_mode: str = "both",
) -> TransportSummary:
    """
    Асинхронный поиск билетов через Travelpayouts Data API с таймаутом и безопасным fallback.
    """
    origin_iata = _get_iata(origin_city) or "MOW"
    dest_iata = _get_iata(destination_city) or "AER"

    if not depart_date:
        now = datetime.now(UTC)
        depart_date = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    month_prefix = depart_date[:7]

    token = settings.TRAVELPAYOUTS_TOKEN
    flight_opt: FlightTicketOption | None = None

    if token:
        url = (
            f"https://api.travelpayouts.com/v1/prices/cheap"
            f"?origin={origin_iata}&destination={dest_iata}"
            f"&depart_date={month_prefix}&currency=rub&token={token}"
        )
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json().get("data", {}).get(dest_iata, {})
                    if data:
                        # Берем первый доступный рейс
                        first_key = next(iter(data))
                        flight_item = data[first_key]
                        airline_code = flight_item.get("airline", "SU")
                        airline_name = AIRLINE_NAMES.get(airline_code, airline_code)
                        dep_at = flight_item.get("departure_at", f"{depart_date}T10:00:00+03:00")
                        dur_to = int(flight_item.get("duration_to", flight_item.get("duration", 240)))

                        # Считаем ориентировочное время прибытия
                        try:
                            dep_dt = datetime.fromisoformat(dep_at)
                            arr_dt = dep_dt + timedelta(minutes=dur_to)
                            arr_iso = arr_dt.isoformat()
                        except Exception:
                            arr_iso = None

                        flight_opt = FlightTicketOption(
                            origin=origin_iata,
                            destination=dest_iata,
                            airline=airline_name,
                            flight_number=f"{airline_code}-{flight_item.get('flight_number', '101')}",
                            departure_at=dep_at,
                            arrival_at=arr_iso,
                            price_rub=int(flight_item.get("price", 5400)),
                            booking_url=_build_aviasales_link(origin_iata, dest_iata, depart_date),
                            duration_min=dur_to,
                            is_direct=True,
                        )
        except Exception as e:
            logger.info(f"Travelpayouts API fallback: {e}")

    # Fallback при отсутствии сети
    if not flight_opt:
        flight_opt = FlightTicketOption(
            origin=origin_iata,
            destination=dest_iata,
            airline="S7 Airlines",
            flight_number=f"S7-204{dest_iata[:2]}",
            departure_at=f"{depart_date}T09:30:00+03:00",
            arrival_at=f"{depart_date}T13:45:00+03:00",
            price_rub=5200,
            booking_url=_build_aviasales_link(origin_iata, dest_iata, depart_date),
            duration_min=255,
            is_direct=True,
        )

    # Ж/Д вариант
    orig_train = _get_train_info(origin_city, "2000000")
    dest_train = _get_train_info(destination_city, "2064130")
    train_opt = TrainTicketOption(
        origin=orig_train["name"],
        destination=dest_train["name"],
        train_number=_get_train_number(orig_train["name"], dest_train["name"]),
        departure_at=f"{depart_date}T14:40:00",
        arrival_at=f"{depart_date}T08:15:00",
        price_from_rub=3600,
        booking_url=_build_tutu_link(orig_train["code"], dest_train["code"], depart_date),
    )

    if preferred_mode == "train":
        arr_str = "08:15"
    else:
        arr_str = "13:45"
        if flight_opt and flight_opt.arrival_at:
            try:
                arr_str = datetime.fromisoformat(flight_opt.arrival_at).strftime("%H:%M")
            except Exception:
                arr_str = "13:45"

    return TransportSummary(
        origin_city=origin_city,
        destination_city=destination_city,
        recommended_flight=flight_opt,
        cheapest_flight=flight_opt,
        recommended_train=train_opt,
        arrival_time=arr_str,
        preferred_mode=preferred_mode,
    )
