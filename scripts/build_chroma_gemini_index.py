"""
Скрипт аспектной индексации отелей и отзывов через Gemini Embedding (text-embedding-004)
Генерирует семантические вектора по 4 ключевым аспектам отеля + профиль:
- vibe_and_sound (шум, тишина, атмосфера)
- view_and_nature (вид из окна, природа, море, горы)
- spa_and_comfort (спа, релакс, чистота, сон)
- hotel_core (название, звезды, город, инфраструктура)

Использует пул ключей GEMINI_API_KEYS (400 RPM) с чередованием round-robin.
Сохраняет векторную коллекцию в outputs/chroma_db_gemini.
"""

import os
import sys
import json
import time
import logging
from typing import List, Dict, Any, Optional
import chromadb
from google import genai
from google.genai import types

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gemini_indexer")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG_PATH = os.path.join(ROOT_DIR, "outputs", "hotels_catalog.json")
FALLBACK_DATASET = os.path.join(ROOT_DIR, "outputs", "hotels_dataset.json")
DB_PATH = os.path.join(ROOT_DIR, "outputs", "chroma_db_gemini")
ENV_PATH = os.path.join(ROOT_DIR, ".env")

EMBED_MODEL = "gemini-embedding-2-preview"
BATCH_SIZE = 50  # 50 текстов в одном батче к Gemini Embeddings API


def load_api_keys() -> List[str]:
    """Загружает список ключей Gemini API из .env."""
    keys = []
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GEMINI_API_KEYS="):
                    val = line.split("=", 1)[1].strip()
                    keys = [k.strip() for k in val.split(",") if k.strip()]
                elif line.startswith("GEMINI_API_KEY=") and not keys:
                    val = line.split("=", 1)[1].strip()
                    if val:
                        keys = [val]
    return keys or [os.environ.get("GEMINI_API_KEY", "")]


def build_aspect_chunks(h: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Формирует смысловые аспектные документы для одного отеля."""
    chunks = []
    h_id = h["id"]
    name = h["name"]
    city = h.get("city", "Москва")
    stars = h.get("stars", 0)
    amenities = h.get("amenities", {})
    summary = h.get("reviews_summary", {})
    pos_quotes = summary.get("positive_highlights", [])
    neg_quotes = summary.get("negative_highlights", [])
    desc = h.get("description", "")

    # Базовые метаданные для фильтрации
    base_meta = {
        "hotel_id": h_id,
        "name": name,
        "city": city,
        "stars": int(stars),
        "min_price_rub": int(h.get("min_price_per_night_rub", 4500)),
        "rating": float(h.get("rating", 4.5)),
        "reviews_count": int(h.get("reviews_count", len(pos_quotes))),
        "spa": str(amenities.get("spa", False)),
        "pet_friendly": str(amenities.get("pet_friendly", False)),
        "heated_pool": str(amenities.get("heated_pool", False)),
        "breakfast_included": str(amenities.get("breakfast_included_available", False)),
    }

    # 1. Основной профиль (Core)
    amenities_list = [k for k, v in amenities.items() if v is True]
    core_text = f"Отель {name} {stars} звезд в г. {city}. Удобства: {', '.join(amenities_list[:8])}. {desc[:300]}"
    chunks.append({
        "id": f"{h_id}_core",
        "aspect": "core",
        "text": core_text,
        "meta": {**base_meta, "aspect": "core"},
    })

    # 2. Аспект: Атмосфера, тишина и уровень шума (Vibe & Sound)
    sound_keywords = ["тишин", "шум", "звукоизоляц", "дорог", "музык", "сосед", "слышим", "спокойн", "уютн", "ноч"]
    sound_pos = [q for q in pos_quotes if any(k in q.lower() for k in sound_keywords)]
    sound_neg = [q for q in neg_quotes if any(k in q.lower() for k in sound_keywords)]
    sound_text = f"Отель {name} в {city}. Тишина, звук и атмосфера: "
    if sound_pos:
        sound_text += f"Гости отмечают: {' '.join(sound_pos[:2])}. "
    if sound_neg:
        sound_text += f"Нюансы по шуму: {' '.join(sound_neg[:2])}."
    if len(sound_text) > 60:
        chunks.append({
            "id": f"{h_id}_sound",
            "aspect": "vibe_and_sound",
            "text": sound_text[:1200],
            "meta": {**base_meta, "aspect": "vibe_and_sound"},
        })

    # 3. Аспект: Вид из окна и пейзаж (View & Nature)
    view_keywords = ["вид", "окн", "панорам", "гор", "мор", "пляж", "закат", "пейзаж", "балкон", "этаж"]
    view_pos = [q for q in pos_quotes if any(k in q.lower() for k in view_keywords)]
    loc_details = h.get("location_details", {})
    dist_beach = loc_details.get("distance_to_beach_m")
    dist_ski = loc_details.get("distance_to_ski_lift_m")
    view_text = f"Отель {name} в {city}. Виды и окружение: "
    if dist_beach:
        view_text += f"До моря/пляжа: {dist_beach} м. "
    if dist_ski:
        view_text += f"До горнолыжного подъемника: {dist_ski} м. "
    if view_pos:
        view_text += f"Отзывы о виде: {' '.join(view_pos[:2])}."
    if len(view_text) > 60:
        chunks.append({
            "id": f"{h_id}_view",
            "aspect": "view_and_nature",
            "text": view_text[:1200],
            "meta": {**base_meta, "aspect": "view_and_nature"},
        })

    # 4. Аспект: СПА, релакс и чистота (SPA & Comfort)
    comfort_keywords = ["спа", "spa", "бассейн", "саун", "хаммам", "матрас", "постел", "кроват", "чистот", "ванн"]
    comfort_pos = [q for q in pos_quotes if any(k in q.lower() for k in comfort_keywords)]
    comfort_text = f"Отель {name} в {city}. Спа, релаксация и комфорт номеров: "
    if comfort_pos:
        comfort_text += f"Впечатления гостей: {' '.join(comfort_pos[:2])}."
    if len(comfort_text) > 60:
        chunks.append({
            "id": f"{h_id}_comfort",
            "aspect": "spa_and_comfort",
            "text": comfort_text[:1200],
            "meta": {**base_meta, "aspect": "spa_and_comfort"},
        })

    return chunks


import re

CACHE_DIR = os.path.join(ROOT_DIR, "outputs", "gemini_vectors_cache")


def generate_embeddings_pool(texts: List[str], keys: List[str]) -> List[List[float]]:
    """Батчевая генерация эмбеддингов с дисковым кэшированием и парсингом retryDelay."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    batches = [texts[i:i + BATCH_SIZE] for i in range(0, len(texts), BATCH_SIZE)]
    total_batches = len(batches)
    embeddings = []
    logger.info(f"Запуск кодирования {total_batches} батчей (по {BATCH_SIZE} текстов) через {len(keys)} ключей...")

    clients = [genai.Client(api_key=k) for k in keys]
    key_idx = 0
    models_pool = ["gemini-embedding-2-preview"]

    for idx, batch in enumerate(batches):
        cache_file = os.path.join(CACHE_DIR, f"batch_{idx}.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    cached_vecs = json.load(f)
                    if len(cached_vecs) == len(batch):
                        embeddings.extend(cached_vecs)
                        if (idx + 1) % 25 == 0 or idx + 1 == total_batches:
                            logger.info(f"[{idx + 1}/{total_batches}] Загружено из кэша ({round((idx + 1)/total_batches * 100, 1)}%)")
                        continue
            except Exception:
                pass

        attempts = 0
        success = False
        while not success and attempts < 500:
            if not clients:
                raise RuntimeError("Все доступные ключи исчерпали лимит!")
            curr_client = clients[key_idx % len(clients)]
            model = models_pool[0]
            key_idx += 1
            try:
                content_items = [types.Content(parts=[types.Part.from_text(text=t)]) for t in batch]
                resp = curr_client.models.embed_content(
                    model=model,
                    contents=content_items,
                )
                batch_vectors = [item.values for item in resp.embeddings]
                if len(batch_vectors) != len(batch):
                    raise ValueError(f"Получено {len(batch_vectors)} векторов для батча из {len(batch)} текстов")

                embeddings.extend(batch_vectors)

                # Сохраняем в кэш на диске
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(batch_vectors, f)

                success = True
                if (idx + 1) % 5 == 0 or idx + 1 == total_batches:
                    logger.info(f"[{idx + 1}/{total_batches}] Закодировано батчей ({round((idx + 1)/total_batches * 100, 1)}%)")
                time.sleep(1.2)
            except Exception as e:
                attempts += 1
                err_str = str(e)
                if "PerDay" in err_str or "limit: 1000" in err_str:
                    logger.warning(f"Ключ исчерпал дневной лимит (1000 req/day). Исключаем его из активного пула. Осталось: {len(clients) - 1}")
                    if curr_client in clients:
                        clients.remove(curr_client)
                    continue

                m = re.search(r"retry in ([\d\.]+)(m?s)", err_str)
                if m:
                    val, unit = float(m.group(1)), m.group(2)
                    wait_s = (val / 1000.0 + 0.5) if unit == "ms" else min(val + 1.0, 30.0)
                else:
                    wait_s = 5.0

                if attempts % max(1, len(clients)) == 0:
                    logger.warning(f"[{idx + 1}/{total_batches}] Все {len(clients)} ключей на паузе. Ожидание {round(wait_s, 1)}с...")
                    time.sleep(wait_s)
                else:
                    time.sleep(min(wait_s, 1.0))

        if not success:
            raise RuntimeError(f"Не удалось закодировать батч {idx} после {attempts} попыток!")

    return embeddings





def main():
    keys = load_api_keys()
    if not keys:
        logger.error("Ключи GEMINI_API_KEYS не найдены в .env!")
        return

    HOTELS_DIR = os.path.join(ROOT_DIR, "outputs", "hotels")
    hotels = []
    if os.path.exists(CATALOG_PATH):
        logger.info(f"Загрузка каталога из: {CATALOG_PATH}")
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            hotels = json.load(f)
    elif os.path.exists(HOTELS_DIR) and len(os.listdir(HOTELS_DIR)) >= 100:
        logger.info(f"Сборка отелей из файлов в {HOTELS_DIR}...")
        for fname in os.listdir(HOTELS_DIR):
            if fname.endswith(".json"):
                fpath = os.path.join(HOTELS_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        hotels.append(json.load(f))
                except Exception:
                    pass
        logger.info(f"Загружено {len(hotels)} отелей из отдельных файлов {HOTELS_DIR}")
    else:
        logger.info(f"Загрузка из fallback: {FALLBACK_DATASET}")
        with open(FALLBACK_DATASET, "r", encoding="utf-8") as f:
            hotels = json.load(f)

    logger.info(f"Формирование аспектных чанков для {len(hotels)} отелей...")
    all_chunks = []
    for h in hotels:
        all_chunks.extend(build_aspect_chunks(h))

    logger.info(f"Всего создано {len(all_chunks)} аспектных документов.")

    texts_to_embed = [c["text"] for c in all_chunks]
    logger.info(f"Генерация векторов Gemini ({EMBED_MODEL}) через пул из {len(keys)} ключей...")
    t0 = time.time()
    vectors = generate_embeddings_pool(texts_to_embed, keys)
    logger.info(f"Генерация {len(vectors)} векторов завершена за {round(time.time() - t0, 1)} сек.")

    # Сохраняем в ChromaDB
    os.makedirs(DB_PATH, exist_ok=True)
    client = chromadb.PersistentClient(path=DB_PATH)
    try:
        client.delete_collection("hotels_aspects")
    except Exception:
        pass

    collection = client.create_collection("hotels_aspects", metadata={"hnsw:space": "cosine"})

    ids = [c["id"] for c in all_chunks]
    docs = [c["text"] for c in all_chunks]
    metas = [c["meta"] for c in all_chunks]

    # Добавление в ChromaDB пачками по 500
    for i in range(0, len(ids), 500):
        end = i + 500
        collection.add(
            ids=ids[i:end],
            embeddings=vectors[i:end],
            documents=docs[i:end],
            metadatas=metas[i:end],
        )

    logger.info(f"Успешно! Коллекция 'hotels_aspects' создана: {collection.count()} векторов в {DB_PATH}")


if __name__ == "__main__":
    main()
