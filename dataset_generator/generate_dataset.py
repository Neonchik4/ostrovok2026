
import json, random, uuid, os
from faker import Faker

fake = Faker("ru_RU")
random.seed(99)

CITIES_CFG = {
    "Сочи": {
        "count": 35,
        "lat": (43.55, 43.65), "lon": (39.70, 39.82),
        "areas": [
            ("Адлер",        "sea",       "ул. Ленина", 43.445, 39.920),
            ("Центр Сочи",   "center",    "ул. Навагинская", 43.600, 39.730),
            ("Хоста",        "sea",       "ул. Абрикосовая", 43.508, 39.848),
            ("Лазаревское",  "sea",       "ул. Победы", 43.908, 39.340),
        ],
        "metro_opts": ["ст. Сочи", "ост. Центральный рынок", "ост. Морской порт"],
        "has_beach": True, "has_ski": False,
    },
    "Красная Поляна": {
        "count": 35,
        "lat": (43.65, 43.73), "lon": (40.15, 40.28),
        "areas": [
            ("Роза Хутор",       "mountains", "ул. Эстосадок", 43.680, 40.295),
            ("Горки Город",      "mountains", "ул. Олимпийская", 43.670, 40.268),
            ("Красная Поляна",   "mountains", "ул. Заповедная", 43.680, 40.200),
        ],
        "metro_opts": ["Роза Хутор", "Эстосадок", "ост. Газпром Отель"],
        "has_beach": False, "has_ski": True,
    },
    "Санкт-Петербург": {
        "count": 40,
        "lat": (59.90, 59.98), "lon": (30.20, 30.42),
        "areas": [
            ("Центр",            "center",    "Невский пр-т", 59.933, 30.335),
            ("Петроградка",      "center",    "ул. Большая Пушкарская", 59.960, 30.307),
            ("Васильевский о-в", "sea",       "Университетская наб.", 59.940, 30.290),
            ("Адмиралтейский",   "center",    "пр-т Майорова", 59.925, 30.308),
        ],
        "metro_opts": ["Невский проспект", "Горьковская", "Василеостровская", "Сенная площадь"],
        "has_beach": False, "has_ski": False,
    },
    "Москва": {
        "count": 35,
        "lat": (55.70, 55.82), "lon": (37.50, 37.72),
        "areas": [
            ("Хамовники",        "center",    "ул. Льва Толстого", 55.730, 37.580),
            ("Замоскворечье",    "center",    "ул. Большая Ордынка", 55.737, 37.635),
            ("Пресня",           "center",    "ул. Красная Пресня", 55.760, 37.570),
            ("Деловой центр",    "center",    "Пресненская наб.", 55.749, 37.540),
        ],
        "metro_opts": ["Парк Культуры", "Третьяковская", "Деловой центр", "Новослободская"],
        "has_beach": False, "has_ski": False,
    },
    "Алтай": {
        "count": 25,
        "lat": (51.80, 52.10), "lon": (85.50, 86.05),
        "areas": [
            ("Чемал",            "nature",    "ул. Набережная", 51.400, 85.864),
            ("Манжерок",         "nature",    "ул. Центральная", 51.800, 85.820),
            ("Горно-Алтайск",    "mountains", "ул. Ленина", 51.959, 85.960),
        ],
        "metro_opts": ["ост. Чемал", "ост. Манжерок", "ост. Горно-Алтайск"],
        "has_beach": False, "has_ski": False,
    },
    "Казань": {
        "count": 30,
        "lat": (55.75, 55.84), "lon": (49.10, 49.22),
        "areas": [
            ("Кремль",           "center",    "ул. Кремлёвская", 55.796, 49.106),
            ("Набережная Волги", "sea",       "ул. Федосеевская", 55.800, 49.150),
            ("Старо-Татарская",  "center",    "ул. Татарстан", 55.785, 49.120),
        ],
        "metro_opts": ["Кремлёвская", "Площадь Тукая", "Суконная слобода"],
        "has_beach": False, "has_ski": False,
    },
}

PREFIXES = ["Гранд", "Уютный", "Лесной", "Горный", "Морской", "Премиум", "Камерный", "Панорама",
            "Альпийский", "Золотой", "Белый", "Северный", "Классик", "Бутик", "Арт"]
SUFFIXES = ["Отель", "Резорт", "Хаус", "Вилла", "Суит", "Инн", "Лодж", "Апарт", "Палас", "Спа"]

VIBES = {
    "mountains": [
        "Уютный горный отель с панорамными видами на заснеженные вершины и хвойные леса.",
        "Идеальная база для горнолыжного сезона — прямо у подъёмников, тёплый камин в лобби.",
        "Тихий шале-стиль в окружении гор: чистый воздух, терраса с видом на ущелье.",
    ],
    "sea": [
        "Свежий морской бриз и шум прибоя — пляж в шаговой доступности.",
        "Видовой отель на берегу: закаты над морем прямо с балкона номера.",
        "Уютный отель у набережной — лёгкая прогулка до моря и рыбных ресторанов.",
    ],
    "center": [
        "В самом сердце города — шаговая доступность музеев, ресторанов и транспортных узлов.",
        "Современный городской отель с отличной транспортной доступностью.",
        "Исторический район, атмосферные улочки, всё главное — рядом.",
    ],
    "nature": [
        "Эко-шале на берегу горной реки: тишина, природа и чистейший воздух Алтая.",
        "Погружение в природу без отказа от комфорта — тайга, река и звёздное небо.",
        "Глэмпинг-стиль в сосновом лесу — медитативный покой вдали от суеты.",
    ],
}

TAGS_MAP = {
    "mountains": ["вид_на_горы", "лыжи_сноуборд", "активный_отдых", "тишина"],
    "sea":        ["вид_на_море", "пляж", "романтика", "закат"],
    "center":     ["центр_города", "культура", "рестораны", "бизнес"],
    "nature":     ["эко", "природа", "тишина", "рыбалка"],
}

POS_REVIEWS = [
    "Великолепный тёплый бассейн с панорамой на горы",
    "Очень приветливый персонал, принесли лежанку для собаки",
    "Тихий район, спалось отлично",
    "Завтрак разнообразный, свежая выпечка каждое утро",
    "Чистейшие номера, хорошая звукоизоляция",
    "Отличный вид из окна, удобная парковка",
    "СПА-центр просто шикарный — сауна и хаммам",
    "Персонал говорит по-английски, очень помогли с экскурсиями",
]
NEG_REVIEWS = [
    "В выходные трудно найти место на парковке",
    "Завтрак хороший, но кофе из автомата",
    "Иногда слышно соседей сверху",
    "Wi-Fi в дальних номерах чуть слабее",
    "Мало розеток в номере",
    "Лифт медленный в часы пик",
]

VIEW_MAP = {"mountains": "mountain", "sea": "sea", "center": "city", "nature": "mountain"}

def gen_room_types(area_type, base_price):
    rooms = []
    view = VIEW_MAP.get(area_type, "city")
    configs = [
        ("std_single",   "Стандартный одноместный",              0.85, 1, 1, 2, "1 односпальная (Twin)", 18, False),
        ("std_double",   "Стандартный двухместный",               1.0,  2, 1, 3, "1 большая двуспальная (King Size)", 24, True),
        ("deluxe_dbl",   "Делюкс двухместный с видом",            1.4,  2, 1, 3, "1 King Size с панорамным окном", 32, True),
        ("family_suite", "Семейный сьют",                         1.9,  3, 2, 5, "1 двуспальная + 2 односпальных", 52, True),
        ("junior_suite", "Студия-люкс",                           2.2,  2, 0, 2, "1 King Size, гостиная зона", 45, True),
    ]
    chosen = random.sample(configs, k=random.randint(2, 4))
    for i, (rid, name, mult, ma, mc, mt, bed, sqm, balc) in enumerate(chosen):
        price = int(base_price * mult / 100) * 100
        rooms.append({
            "room_id": f"{rid}_{i+1}",
            "name": name,
            "price_per_night_rub": price,
            "capacity": {"max_adults": ma, "max_children": mc, "max_total_guests": mt},
            "bed_setup": bed,
            "area_sqm": sqm,
            "has_balcony": balc,
            "view": view,
            "breakfast_included": random.random() < 0.4,
            "available_rooms_count": random.randint(1, 6),
        })
    return rooms

def gen_hotel(idx, city, cfg):
    area_info = random.choice(cfg["areas"])
    area_name, area_type, street, base_lat, base_lon = area_info
    lat = round(base_lat + random.uniform(-0.02, 0.02), 6)
    lon = round(base_lon + random.uniform(-0.03, 0.03), 6)
    stars = random.choices([3, 4, 5], weights=[3, 4, 3])[0]
    base_price = {3: random.randint(3500, 8000), 4: random.randint(7000, 18000), 5: random.randint(15000, 40000)}[stars]

    pet_friendly  = random.random() < 0.40
    heated_pool   = random.random() < 0.35
    outdoor_pool  = random.random() < 0.25
    spa           = random.random() < 0.40
    sauna         = random.random() < 0.45
    fast_wifi     = random.random() < 0.90
    free_parking  = random.random() < 0.55
    restaurant    = random.random() < 0.65
    breakfast_av  = random.random() < 0.70
    gym           = random.random() < 0.50
    kids_club     = random.random() < 0.30
    coworking     = random.random() < 0.25
    ski_storage   = (area_type == "mountains") and (random.random() < 0.75)
    free_cancel   = random.random() < 0.60

    dist_beach    = random.randint(50, 800)   if cfg["has_beach"] else None
    dist_ski      = random.randint(50, 1200)  if cfg["has_ski"]   else None
    dist_center   = round(random.uniform(0.3, 12.0), 1)
    dist_transport= random.randint(50, 600)
    metro         = random.choice(cfg["metro_opts"])

    rating = round(random.uniform(3.2, 5.0), 1)
    reviews_count = random.randint(15, 2500)
    min_stay = random.choices([1, 2, 3], weights=[6, 3, 1])[0]

    room_types = gen_room_types(area_type, base_price)
    min_price = min(r["price_per_night_rub"] for r in room_types)

    tags = list(TAGS_MAP[area_type])
    if pet_friendly:  tags.append("дог-френдли")
    if spa:           tags.append("спа_релакс")
    if kids_club:     tags.append("для_семей")
    if coworking:     tags.append("работа_коворкинг")
    if romantic := (random.random() < 0.3): tags.append("романтика")
    tags = list(set(tags))

    amenity_parts = []
    if heated_pool:  amenity_parts.append("подогреваемый бассейн")
    if spa:          amenity_parts.append("спа-центр")
    if sauna:        amenity_parts.append("сауна")
    if restaurant:   amenity_parts.append("ресторан")
    if gym:          amenity_parts.append("фитнес-зал")
    if pet_friendly: amenity_parts.append("размещение питомцев")
    if free_parking: amenity_parts.append("бесплатная парковка")
    if kids_club:    amenity_parts.append("детский клуб")

    vibe = random.choice(VIBES[area_type])
    description = (
        f"{vibe} "
        f"Расположен в районе «{area_name}» ({city}), адрес: {street}, {random.randint(1,120)}. "
        f"Рейтинг гостей: {rating}/5.0 на основе {reviews_count} отзывов. "
        f"Звёздность: {'★' * stars}. "
        f"Цены от {min_price:,} ₽/ночь. "
        + (f"До моря {dist_beach} м. " if dist_beach else "")
        + (f"До подъёмника {dist_ski} м. " if dist_ski else "")
        + f"До центра {dist_center} км. "
        + (f"Удобства: {', '.join(amenity_parts)}. " if amenity_parts else "")
        + f"Теги: {', '.join(tags)}."
    )

    name = f"{random.choice(PREFIXES)} {random.choice(SUFFIXES)} {idx}"

    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "city": city,
        "stars": stars,
        "area": area_name,
        "area_type": area_type,
        "address": f"{street}, {random.randint(1, 120)}",
        "coordinates": {"lat": lat, "lon": lon},
        "min_price_per_night_rub": min_price,
        "rating": rating,
        "reviews_count": reviews_count,
        "location_details": {
            "distance_to_center_km": dist_center,
            "distance_to_beach_m": dist_beach,
            "distance_to_ski_lift_m": dist_ski,
            "nearest_metro_or_station": metro,
            "distance_to_transport_m": dist_transport,
        },
        "amenities": {
            "pet_friendly": pet_friendly, "heated_pool": heated_pool,
            "outdoor_pool": outdoor_pool, "spa": spa, "sauna": sauna,
            "fast_wifi": fast_wifi, "free_parking": free_parking,
            "paid_parking": not free_parking and random.random() < 0.5,
            "restaurant_on_site": restaurant,
            "breakfast_included_available": breakfast_av,
            "gym": gym, "kids_club": kids_club,
            "coworking_zone": coworking, "ski_storage": ski_storage,
        },
        "room_types": room_types,
        "policies": {
            "check_in_time": random.choice(["13:00", "14:00", "15:00"]),
            "check_out_time": random.choice(["11:00", "12:00"]),
            "early_check_in_available": random.random() < 0.5,
            "late_check_out_available": random.random() < 0.4,
            "min_stay_nights": min_stay,
            "cancellation": {
                "is_free_cancellation": free_cancel,
                "free_cancellation_deadline_hours": 48 if free_cancel else 0,
                "penalty_rub": 0 if free_cancel else min_price,
            },
            "pets": {
                "allowed": pet_friendly,
                "max_pets": random.choice([1, 2]) if pet_friendly else 0,
                "max_weight_kg": random.choice([5, 10, 15, 20]) if pet_friendly else 0,
                "deposit_rub": random.randint(1000, 5000) if pet_friendly else 0,
                "daily_fee_rub": random.choice([0, 300, 500, 700]) if pet_friendly else 0,
                "allowed_types": random.choice([["dogs","cats"], ["dogs"], ["cats"], ["dogs","cats","birds"]]) if pet_friendly else [],
                "restrictions_note": f"Питомцы до {random.choice([5,10,15,20])} кг с ветпаспортом" if pet_friendly else "Питомцы не разрешены",
            },
            "children": {
                "allowed": True,
                "free_child_age_limit": random.choice([3, 5, 6, 7]),
                "extra_bed_price_rub": random.randint(800, 2500),
            },
        },
        "tags": tags,
        "reviews_summary": {
            "score_cleanliness": round(random.uniform(3.5, 5.0), 1),
            "score_location":    round(random.uniform(3.5, 5.0), 1),
            "score_service":     round(random.uniform(3.2, 5.0), 1),
            "positive_highlights": random.sample(POS_REVIEWS, k=random.randint(2, 4)),
            "negative_highlights": random.sample(NEG_REVIEWS,  k=random.randint(1, 3)),
        },
        "description": description,
        "image_urls": [
            f"https://images.ostrovok.ru/mock/{uuid.uuid4().hex[:8]}_exterior.jpg",
            f"https://images.ostrovok.ru/mock/{uuid.uuid4().hex[:8]}_room.jpg",
            f"https://images.ostrovok.ru/mock/{uuid.uuid4().hex[:8]}_pool_spa.jpg",
            f"https://images.ostrovok.ru/mock/{uuid.uuid4().hex[:8]}_breakfast.jpg",
        ],
    }

hotels = []
idx = 1
for city, cfg in CITIES_CFG.items():
    for _ in range(cfg["count"]):
        hotels.append(gen_hotel(idx, city, cfg))
        idx += 1

os.makedirs("./outputs", exist_ok=True)
with open("./outputs/hotels_dataset.json", "w", encoding="utf-8") as f:
    json.dump(hotels, f, ensure_ascii=False, indent=2)

print(f"✅ Датасет: {len(hotels)} отелей")
for city in CITIES_CFG:
    c = sum(1 for h in hotels if h["city"] == city)
    print(f"   {city}: {c}")
print(f"   Pet-friendly: {sum(h['amenities']['pet_friendly'] for h in hotels)}")
print(f"   Подогрев. бассейн: {sum(h['amenities']['heated_pool'] for h in hotels)}")
print(f"   СПА: {sum(h['amenities']['spa'] for h in hotels)}")
print(f"   Бесплатная отмена: {sum(h['policies']['cancellation']['is_free_cancellation'] for h in hotels)}")
