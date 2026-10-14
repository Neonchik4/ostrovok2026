"""Script for generating rich 768-dim embeddings on GPU (RTX 3050) using mpnet-base-v2."""
import os
import sys
import json
import time
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "backend"))

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
OUTPUT_CACHE_PATH = BASE_DIR / "outputs" / "mpnet_vectors_768.json"


def main():
    print(f"[Embedding Reindex] Запуск векторизации с моделью {MODEL_NAME} (768 dim)...")
    dataset_path = BASE_DIR / "outputs" / "hotels.json"
    if not dataset_path.exists():
        print(f"[Error] Файл датасета {dataset_path} не найден.")
        return

    with open(dataset_path, "r", encoding="utf-8") as f:
        hotels = json.load(f)

    print(f"[Dataset] Загружено {len(hotels)} отелей.")

    import torch
    from sentence_transformers import SentenceTransformer
    from backend.app.services.semantic_builder import build_hotel_semantic_document

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[PyTorch Device] Используется устройство: {device.upper()}")
    if device == "cuda":
        print(f"[GPU Name] {torch.cuda.get_device_name(0)}")

    start_load = time.time()
    model = SentenceTransformer(MODEL_NAME, device=device)
    print(f"[Model] Модель загружена за {time.time() - start_load:.2f} сек.")

    # Формируем тексты
    print("[Processing] Формирование структурированных семантических описаний...")
    documents = [build_hotel_semantic_document(h) for h in hotels]
    hotel_ids = [h["id"] for h in hotels]

    batch_size = 64 if device == "cuda" else 32
    print(f"[Inference] Расчет векторов (всего {len(documents)}, размер батча {batch_size})...")

    start_calc = time.time()
    embeddings = model.encode(
        documents,
        batch_size=batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,
    )
    total_time = time.time() - start_calc
    print(f"[Success] Векторизация {len(hotels)} отелей завершена за {total_time:.2f} сек!")

    # Сохраняем в кэш
    cache_data = {}
    for h_id, emb in zip(hotel_ids, embeddings):
        cache_data[h_id] = emb.tolist()

    with open(OUTPUT_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache_data, f)
    print(f"[Saved] Вектора сохранены в {OUTPUT_CACHE_PATH} ({len(cache_data)} записей, размерность {len(embeddings[0])})")


if __name__ == "__main__":
    main()
