
import chromadb, shutil, os, json
from sentence_transformers import SentenceTransformer

# Загрузка датасета отелей
DATASET_PATH = "./outputs/hotels_dataset.json"
if not os.path.exists(DATASET_PATH):
    raise FileNotFoundError(f"Файл {DATASET_PATH} не найден. Сначала запустите generate_dataset.py")

with open(DATASET_PATH, "r", encoding="utf-8") as f:
    hotels = json.load(f)

# Используем путь к ChromaDB v2
DB_PATH = "./outputs/chroma_db_v2"
if os.path.exists(DB_PATH):
    shutil.rmtree(DB_PATH)
os.makedirs(DB_PATH, exist_ok=True)

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
chroma_client = chromadb.PersistentClient(path=DB_PATH)
collection = chroma_client.create_collection("hotels", metadata={"hnsw:space": "cosine"})

descriptions = [h["description"] for h in hotels]
print("Генерация эмбеддингов для 200 отелей...")
embeddings = model.encode(descriptions, batch_size=32, show_progress_bar=True).tolist()

ids = [h["id"] for h in hotels]
metadatas = []
for h in hotels:
    loc = h["location_details"]
    metadatas.append({
        "hotel_id":              h["id"],
        "name":                  h["name"],
        "city":                  h["city"],
        "area_type":             h["area_type"],
        "stars":                 h["stars"],
        "min_price_rub":         h["min_price_per_night_rub"],
        "rating":                h["rating"],
        "reviews_count":         h["reviews_count"],
        "pet_friendly":          str(h["amenities"]["pet_friendly"]),
        "heated_pool":           str(h["amenities"]["heated_pool"]),
        "spa":                   str(h["amenities"]["spa"]),
        "breakfast_included":    str(h["amenities"]["breakfast_included_available"]),
        "free_cancellation":     str(h["policies"]["cancellation"]["is_free_cancellation"]),
        "min_stay_nights":       h["policies"]["min_stay_nights"],
        "lat":                   h["coordinates"]["lat"],
        "lon":                   h["coordinates"]["lon"],
        "distance_to_ski_lift_m": loc["distance_to_ski_lift_m"] if loc["distance_to_ski_lift_m"] is not None else 99999,
        "distance_to_beach_m":   loc["distance_to_beach_m"] if loc["distance_to_beach_m"] is not None else 99999,
    })

collection.add(ids=ids, embeddings=embeddings, documents=descriptions, metadatas=metadatas)
print(f"✅ ChromaDB v2: {collection.count()} документов в индексе → {DB_PATH}")
