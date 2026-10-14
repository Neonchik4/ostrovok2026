from app.services.location_registry import get_known_cities, match_city


def test_get_known_cities_coverage():
    cities = get_known_cities()
    assert len(cities) >= 19
    expected_sample = [
        "Москва", "Санкт-Петербург", "Сочи", "Красная Поляна",
        "Казань", "Калининград", "Екатеринбург", "Нижний Новгород",
        "Шерегеш", "Алтай", "Иркутск (Байкал)", "Дагестан (Махачкала)",
        "Карелия (Петрозаводск)", "Владивосток", "Анапа", "Геленджик",
        "Зеленоградск", "Мурманск", "Самара"
    ]
    for c in expected_sample:
        assert c in cities

def test_match_city_declensions():
    assert match_city("Хочу поехать в Москву") == "Москва"
    assert match_city("Отели в Санкт-Петербурге на двоих") == "Санкт-Петербург"
    assert match_city("Отдых в Казани на выходные") == "Казань"
    assert match_city("Поездка в Калининграде") == "Калининград"
    assert match_city("Снять номер в Сочи") == "Сочи"
    assert match_city("Едем на Красную Поляну") == "Красная Поляна"
    assert match_city("Кататься на Поляне") == "Красная Поляна"

def test_match_city_slang_and_abbreviations():
    assert match_city("В Питер на 2 ночи") == "Санкт-Петербург"
    assert match_city("Отели в спб") == "Санкт-Петербург"
    assert match_city("Поездка в мск") == "Москва"
    assert match_city("Едем в екб") == "Екатеринбург"
    assert match_city("Отель в екате") == "Екатеринбург"
    assert match_city("Покататься в геше") == "Шерегеш"
    assert match_city("Горнолыжный тур в Шерегеше") == "Шерегеш"
    assert match_city("Отпуск на Байкале") == "Иркутск (Байкал)"
    assert match_city("Отели в Иркутске") == "Иркутск (Байкал)"
    assert match_city("Тур в Дагестане") == "Дагестан (Махачкала)"
    assert match_city("Отель в Махачкале") == "Дагестан (Махачкала)"
    assert match_city("Поездка в Карелию") == "Карелия (Петрозаводск)"
    assert match_city("Отель в Петрозаводске") == "Карелия (Петрозаводск)"
    assert match_city("Командировка во Владик") == "Владивосток"
    assert match_city("Отели во Владивостоке") == "Владивосток"
    assert match_city("Тур на Алтай") == "Алтай"
    assert match_city("Отели в Горно-Алтайске") == "Алтай"
    assert match_city("Выходные в Нижнем Новгороде") == "Нижний Новгород"
    assert match_city("Поездка в Нижний") == "Нижний Новгород"
    assert match_city("Северное сияние в Мурманске") == "Мурманск"
    assert match_city("Поездка в Териберку") == "Мурманск"
    assert match_city("Отдых в Зеленоградске") == "Зеленоградск"
    assert match_city("Лето в Анапе") == "Анапа"
    assert match_city("Отпуск в Геленджике") == "Геленджик"
    assert match_city("Отель в Самаре") == "Самара"

def test_match_city_unknown():
    assert match_city("Неизвестный Город") is None
    assert match_city("") is None
    assert match_city(None) is None
