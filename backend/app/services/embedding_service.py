from typing import List, Dict

EMBED_MODEL = "gemini-embedding-2-preview"
_query_cache: Dict[str, List[float]] = {}
_MAX_CACHE_SIZE = 500
