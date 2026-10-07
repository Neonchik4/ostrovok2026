import json
import os
import asyncio
from typing import List, Dict, Optional, TYPE_CHECKING
from ..config import settings
from ..schemas.hotel_models import HotelFullSchema
from .embedding_service import embed_text_gemini

if TYPE_CHECKING:
    from chromadb.api.models.Collection import Collection
    from sentence_transformers import SentenceTransformer

_hotels_dataset: List[HotelFullSchema] = []
_hotels_by_id: Dict[str, HotelFullSchema] = {}
_chroma_collection: Optional["Collection"] = None
_embedding_model: Optional["SentenceTransformer"] = None
_is_gemini_vector: bool = False


def init_dataset() -> None:
    """Инициализация и кэширование датасета отелей (каталог или полный датасет)."""
    global _hotels_dataset, _hotels_by_id
    if not _hotels_dataset:
        candidates = [
            "./outputs/hotels.json",
            "../outputs/hotels.json",
            "outputs/hotels.json",
            settings.DATASET_PATH,
        ]
        for p in candidates:
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        raw_data = json.load(f)
                    if len(raw_data) >= 100:
                        _hotels_dataset = [HotelFullSchema.model_validate(h) for h in raw_data]
                        _hotels_by_id = {h.id: h for h in _hotels_dataset}
                        print(f"[Dataset] Загружено {len(_hotels_dataset)} отелей из {p}")
                        break
                except Exception as e:
                    print(f"[Dataset Warning] Ошибка чтения {p}: {e}")


def get_hotels_dataset() -> List[HotelFullSchema]:
    if not _hotels_dataset:
        init_dataset()
    return _hotels_dataset


def get_hotel_by_id(hotel_id: str) -> Optional[HotelFullSchema]:
    if not _hotels_by_id:
        init_dataset()
    return _hotels_by_id.get(hotel_id)


def warmup_models() -> None:
    """Прогрев ChromaDB и эмбеддера в FastAPI Lifespan."""
    global _chroma_collection, _embedding_model, _is_gemini_vector
    init_dataset()

    # 1. Попытка подключения к ChromaDB с приоритетом Gemini Aspect Collection
    try:
        import chromadb
        gemini_candidates = [
            "./outputs/chroma_db_gemini",
            "../outputs/chroma_db_gemini",
            "outputs/chroma_db_gemini",
        ]
        v2_candidates = [
            settings.CHROMA_DB_PATH,
            "./outputs/chroma_db_v2",
            "../outputs/chroma_db_v2",
            "outputs/chroma_db_v2",
        ]

        # Сначала проверяем базу Gemini
        for p in gemini_candidates:
            if os.path.exists(p):
                client = chromadb.PersistentClient(path=p)
                try:
                    _chroma_collection = client.get_collection("hotels_aspects")
                    _is_gemini_vector = True
                    print(f"[ChromaDB] Подключено к Gemini Aspects в {p} ({_chroma_collection.count()} векторов)")
                    return
                except Exception:
                    pass

        # Фолбэк на v2 базу
        for p in v2_candidates:
            if os.path.exists(p):
                client = chromadb.PersistentClient(path=p)
                _chroma_collection = client.get_collection("hotels")
                _is_gemini_vector = False
                print(f"[ChromaDB] Подключено к {p} ({_chroma_collection.count()} документов)")
                break
    except Exception as e:
        print(f"[ChromaDB Warning] Не удалось подключиться к ChromaDB: {e}. Будет использован in-memory поиск.")
        _chroma_collection = None

    # 2. Инициализация SentenceTransformer для локального фолбэка
    if not _is_gemini_vector:
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
            print("[Embedding] SentenceTransformer инициализирован успешно.")
        except Exception as e:
            print(f"[Embedding Warning] Не удалось загрузить SentenceTransformer: {e}")
            _embedding_model = None


def is_vector_ready() -> bool:
    if _is_gemini_vector:
        return _chroma_collection is not None
    return _chroma_collection is not None and _embedding_model is not None


async def query_chroma_raw(query_text: str, n_results: int = 50) -> Optional[dict]:
    """
    Выполняет векторный запрос к ChromaDB через Gemini Embedding или SentenceTransformers.
    """
    if not is_vector_ready() or not _chroma_collection:
        return None

    try:
        if _is_gemini_vector:
            emb = await embed_text_gemini(query_text)
            if not emb:
                return None
            query_emb = [emb]
        else:
            if not _embedding_model:
                return None
            query_emb = await asyncio.to_thread(_embedding_model.encode, [query_text])
            query_emb = query_emb.tolist()

        n_query = min(n_results * 2 if _is_gemini_vector else n_results, _chroma_collection.count())
        res = _chroma_collection.query(
            query_embeddings=query_emb,
            n_results=n_query,
            include=["metadatas", "distances"]
        )

        # Если это аспектная коллекция, дедуплицируем по hotel_id сохраняя наименьшую дистанцию
        if _is_gemini_vector and res and "metadatas" in res and res["metadatas"]:
            seen_hotels = set()
            dedup_metas = []
            dedup_dists = []
            orig_metas = res["metadatas"][0]
            orig_dists = res["distances"][0] if "distances" in res and res["distances"] else [0.0] * len(orig_metas)

            for meta, dist in zip(orig_metas, orig_dists):
                h_id = meta.get("hotel_id")
                if h_id and h_id not in seen_hotels:
                    seen_hotels.add(h_id)
                    dedup_metas.append(meta)
                    dedup_dists.append(dist)
                if len(dedup_metas) >= n_results:
                    break

            return {"metadatas": [dedup_metas], "distances": [dedup_dists]}

        return res
    except Exception as e:
        print(f"[ChromaDB Query Error]: {e}")
        return None
