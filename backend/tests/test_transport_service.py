import pytest

from app.services.transport_service import (
    _build_aviasales_link,
    _build_tutu_link,
    _get_iata,
    search_transport_options,
)


def test_iata_mapping_coverage():
    assert _get_iata("Москва") == "MOW"
    assert _get_iata("Сочи") == "AER"
    assert _get_iata("Красная Поляна") == "AER"
    assert _get_iata("Санкт-Петербург") == "LED"
    assert _get_iata("Питер") == "LED"
    assert _get_iata("Казань") == "KZN"
    assert _get_iata("Екатеринбург") == "SVX"
    assert _get_iata("Калининград") == "KGD"
    assert _get_iata("Владивосток") == "VVO"


def test_deep_links_generation():
    aviasales_url = _build_aviasales_link("MOW", "AER", "2026-11-15")
    assert "aviasales.ru/search/MOW" in aviasales_url
    assert "AER1?marker=ostrovok2026" in aviasales_url

    tutu_url = _build_tutu_link("2000000", "2064130", "2026-11-15")
    assert "tutu.ru/poezda/rasp_d.php" in tutu_url
    assert "nnst1=2000000" in tutu_url
    assert "nnst2=2064130" in tutu_url


@pytest.mark.asyncio
async def test_search_transport_options_fallback_and_types():
    """Проверяет асинхронный поиск транспорта и корректность структуры данных."""
    summary = await search_transport_options(
        origin_city="Москва",
        destination_city="Сочи",
        depart_date="2026-11-20",
    )
    assert summary.origin_city == "Москва"
    assert summary.destination_city == "Сочи"
    assert summary.recommended_flight is not None
    assert summary.recommended_flight.price_rub > 1000
    assert summary.recommended_flight.is_direct is True
    assert summary.recommended_flight.booking_url.startswith("https://www.aviasales.ru")

    assert summary.recommended_train is not None
    assert summary.recommended_train.price_from_rub > 1000
    assert summary.recommended_train.booking_url.startswith("https://www.tutu.ru")
    assert summary.arrival_time is not None


@pytest.mark.asyncio
async def test_search_transport_options_train_mode_and_default_date():
    summary = await search_transport_options(
        origin_city="Анапа",
        destination_city="Санкт-Петербург",
        preferred_mode="train",
    )
    assert summary.preferred_mode == "train"
    assert summary.arrival_time == "08:15"
    assert summary.recommended_train is not None
    assert summary.origin_city == "Анапа"
    assert summary.destination_city == "Санкт-Петербург"
    assert "tutu.ru/poezda/rasp_d.php" in summary.recommended_train.booking_url


@pytest.mark.asyncio
async def test_search_transport_anapa_to_moscow():
    summary = await search_transport_options(
        origin_city="Анапа",
        destination_city="Москва",
        preferred_mode="both",
    )
    assert summary.origin_city == "Анапа"
    assert summary.destination_city == "Москва"
    assert summary.recommended_flight is not None
    assert summary.recommended_flight.origin == "AAQ"
    assert summary.recommended_flight.destination == "MOW"
    assert summary.recommended_train is not None
    assert summary.recommended_train.origin == "Анапа"
    assert summary.recommended_train.destination == "Москва"
    assert "Анапа" in summary.recommended_train.train_number
    assert "Москва" in summary.recommended_train.train_number
    # Код вокзала Анапы в Экспресс-3 — строго 2064188 (не Новороссийск 2064110)
    assert "nnst1=2064188" in summary.recommended_train.booking_url
    assert "nnst2=2000000" in summary.recommended_train.booking_url
    assert "2064110" not in summary.recommended_train.booking_url

