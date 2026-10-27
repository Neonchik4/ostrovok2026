from .llm_client import _get_api_keys, _get_client, _mask_key
from .offline_mode import is_auth_error, is_offline_mode, register_dead_key

EMBED_MODEL = "gemini-embedding-2-preview"
_query_cache: dict[str, list[float]] = {}
_MAX_CACHE_SIZE = 500


async def embed_text_gemini(text: str) -> list[float] | None:
    """
    Генерирует вектор текста через Gemini Embeddings API (gemini-embedding-2-preview).
    Использует пул ключей GEMINI_API_KEYS и in-memory кэш запросов.
    Zero-Config Offline Mode: без валидных ключей возвращает None без сетевых вызовов,
    векторный поиск уходит на локальный SentenceTransformer (Issue #46).
    """
    cleaned = text.strip()
    if not cleaned:
        return None

    if cleaned in _query_cache:
        return _query_cache[cleaned]

    if is_offline_mode():
        return None

    keys = _get_api_keys()
    if not keys:
        return None

    for key in keys:
        try:
            client = _get_client(key)
            resp = await client.aio.models.embed_content(
                model=EMBED_MODEL,
                contents=cleaned,
            )
            if resp and resp.embeddings and len(resp.embeddings) > 0:
                vector = resp.embeddings[0].values
                if len(_query_cache) >= _MAX_CACHE_SIZE:
                    _query_cache.pop(next(iter(_query_cache)))
                _query_cache[cleaned] = vector
                return vector
        except Exception as e:
            if is_auth_error(str(e)):
                register_dead_key(key)
            print(f"[Embedding Service] Ошибка ключа {_mask_key(key)}: {e}. Пробуем следующий...")

    return None
