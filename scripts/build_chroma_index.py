
import chromadb, shutil, os, json
from sentence_transformers import SentenceTransformer

# Загрузка датасета отелей: итоговый hotels.json, fallback — legacy hotels_dataset.json
DATASET_PATH = "./outputs/hotels.json"
if not os.path.exists(DATASET_PATH):
    DATASET_PATH = "./outputs/hotels_dataset.json"
if not os.path.exists(DATASET_PATH):
    raise FileNotFoundError("Файл outputs/hotels.json не найден. Сначала запустите scripts/build_hotels_json.py.")

with open(DATASET_PATH, "r", encoding="utf-8") as f:
    hotels = json.load(f)

print(f"Загружено {len(hotels)} отелей для индексации в ChromaDB v2...")

# Используем путь к ChromaDB v2
DB_PATH = "./outputs/chroma_db_v2"
os.makedirs(DB_PATH, exist_ok=True)

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
chroma_client = chromadb.PersistentClient(path=DB_PATH)
try:
    chroma_client.delete_collection("hotels")
except Exception:
    pass
collection = chroma_client.create_collection("hotels", metadata={"hnsw:space": "cosine"})

descriptions = [h.get("description") or f"{h['name']} в г. {h['city']}" for h in hotels]
print(f"Генерация эмбеддингов для {len(descriptions)} отелей (batch_size=64)...")
embeddings = model.encode(descriptions, batch_size=64, show_progress_bar=True).tolist()

ids = [h["id"] for h in hotels]
metadatas = []
for h in hotels:
    loc = h.get("location_details", {})
    coords = h.get("coordinates") or {"lat": 55.75, "lon": 37.61}
    amenities = h.get("amenities", {})
    policies = h.get("policies", {})
    canc = policies.get("cancellation", {})

    metadatas.append({
        "hotel_id":              h["id"],
        "name":                  h["name"],
        "city":                  h["city"],
        "area_type":             h.get("area_type", "center"),
        "stars":                 int(h.get("stars", 0)),
        "min_price_rub":         int(h.get("min_price_per_night_rub", 4500)),
        "rating":                float(h.get("rating", 4.5)),
        "reviews_count":         int(h.get("reviews_count", 20)),
        "pet_friendly":          str(amenities.get("pet_friendly", False)),
        "heated_pool":           str(amenities.get("heated_pool", False)),
        "spa":                   str(amenities.get("spa", False)),
        "breakfast_included":    str(amenities.get("breakfast_included_available", False)),
        "free_cancellation":     str(canc.get("is_free_cancellation", True)),
        "min_stay_nights":       int(policies.get("min_stay_nights", 1)),
        "lat":                   float(coords.get("lat", 55.75)),
        "lon":                   float(coords.get("lon", 37.61)),
        "distance_to_ski_lift_m": loc.get("distance_to_ski_lift_m") if loc.get("distance_to_ski_lift_m") is not None else 99999,
        "distance_to_beach_m":   loc.get("distance_to_beach_m") if loc.get("distance_to_beach_m") is not None else 99999,
    })

# Батчевое добавление (порциями по 500 для соблюдения лимитов SQLite)
BATCH_SIZE = 500
for i in range(0, len(ids), BATCH_SIZE):
    end = i + BATCH_SIZE
    collection.add(
        ids=ids[i:end],
        embeddings=embeddings[i:end],
        documents=descriptions[i:end],
        metadatas=metadatas[i:end],
    )
    print(f"Добавлено {min(end, len(ids))}/{len(ids)} отелей в ChromaDB...")

print(f"✅ Успешно! ChromaDB v2: {collection.count()} документов в индексе → {DB_PATH}")

