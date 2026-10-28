import asyncio
import time
from types import SimpleNamespace
from typing import Any

from .llm_client import _get_api_keys, _get_client, _mask_key
from .llm_usage import gateway_cache_hit, record_llm_call
from .offline_mode import is_auth_error, is_offline_mode, register_dead_key

EMBED_MODEL = "gemini-embedding-2-preview"
_query_cache: dict[str, list[float]] = {}
_MAX_CACHE_SIZE = 500


async def _count_tokens(client: Any, text: str) -> int | None:
    """
    Embeddings API не возвращает usage — число оплачиваемых токенов берём из
    бесплатного countTokens той же модели (параллельно с эмбеддингом, без задержки).
    """
    try:
        counted = await client.aio.models.count_tokens(model=EMBED_MODEL, contents=text)
        return getattr(counted, "total_tokens", None)
    except Exception:
        return None


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
            started = time.monotonic()
            resp, tokens = await asyncio.gather(
                client.aio.models.embed_content(
                    model=EMBED_MODEL,
                    contents=cleaned,
                ),
                _count_tokens(client, cleaned),
            )
            # Подсчёт не удался — вызов всё равно в отчёте, но с «не удалось получить»
            record_llm_call(
                stage="embedding",
                model=EMBED_MODEL,
                usage=SimpleNamespace(prompt_token_count=tokens, total_token_count=tokens)
                if tokens is not None
                else None,
                duration_ms=int((time.monotonic() - started) * 1000),
                gateway_cache_hit=gateway_cache_hit(resp),
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
