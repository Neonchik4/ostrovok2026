import json
import os
from typing import List, Dict, Optional, TYPE_CHECKING
from ..config import settings
from ..schemas.hotel_models import HotelFullSchema

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
        if not any(os.path.exists(p) for p in candidates):
            try:
                from .dataset_loader import ensure_dataset_available
                ensure_dataset_available()
            except Exception as e:
                print(f"[Dataset Warning] Автоматическая загрузка датасета не удалась: {e}")
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
