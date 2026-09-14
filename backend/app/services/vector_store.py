import json
import os
import asyncio
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

def init_dataset() -> None:
    """Инициализация и кэширование датасета отелей."""
    global _hotels_dataset, _hotels_by_id
    if not _hotels_dataset:
        candidates = [
            settings.DATASET_PATH,
            "./outputs/hotels_dataset.json",
            "../outputs/hotels_dataset.json",
            "outputs/hotels_dataset.json"
        ]
        for p in candidates:
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    _hotels_dataset = [HotelFullSchema.model_validate(h) for h in raw_data]
                    _hotels_by_id = {h.id: h for h in _hotels_dataset}
                print(f"[Dataset] Загружено {len(_hotels_dataset)} отелей из {p}")
                break

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
    global _chroma_collection, _embedding_model
    init_dataset()

    # Попытка инициализации SentenceTransformer
    try:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
        print("[Embedding] SentenceTransformer инициализирован успешно.")
    except Exception as e:
        print(f"[Embedding Warning] Не удалось загрузить SentenceTransformer: {e}. Будет использован in-memory ранжировщик.")
        _embedding_model = None

    # Попытка подключения к ChromaDB
    try:
        import chromadb
        candidates = [
            settings.CHROMA_DB_PATH,
            "./outputs/chroma_db_v2",
            "../outputs/chroma_db_v2",
            "./outputs/chroma_db",
            "outputs/chroma_db_v2"
        ]
        db_path = None
        for p in candidates:
            if os.path.exists(p):
                db_path = p
                break
        if db_path:
            client = chromadb.PersistentClient(path=db_path)
            _chroma_collection = client.get_collection("hotels")
            print(f"[ChromaDB] Подключено к {db_path} ({_chroma_collection.count()} документов)")
    except Exception as e:
        print(f"[ChromaDB Warning] Не удалось подключиться к ChromaDB: {e}. Будет использован in-memory поиск.")
        _chroma_collection = None

def is_vector_ready() -> bool:
    return _chroma_collection is not None and _embedding_model is not None

async def query_chroma_raw(query_text: str, n_results: int = 50) -> Optional[dict]:
    """
    Выполняет векторный запрос к ChromaDB через sentence-transformers.
    """
    if not is_vector_ready():
        return None

    try:
        query_emb = await asyncio.to_thread(_embedding_model.encode, [query_text])
        n_query = min(n_results, _chroma_collection.count())
        res = _chroma_collection.query(
            query_embeddings=query_emb.tolist(),
            n_results=n_query,
            include=["metadatas", "distances"]
        )
        return res
    except Exception as e:
        print(f"[ChromaDB Query Error]: {e}")
        return None
