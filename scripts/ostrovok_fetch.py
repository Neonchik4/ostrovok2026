"""
Загрузка страниц каталога Ostrovok.ru с локальным дисковым кешированием.
Сначала читает outputs/raw_ostrovok/, в сеть ходит только при промисе кэша.
Вежливая пауза 0.35-0.65с между живыми запросами.
"""

import json
import logging
import os
import random
import re
import time
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("ostrovok_parser")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
}


def fetch_page_cached(client: httpx.Client, region_slug: str, page: int,
                      cache_dir: str) -> Optional[List[Dict[str, Any]]]:
    """Загружает страницу каталога Островка с локальным дисковым кешированием."""
    os.makedirs(cache_dir, exist_ok=True)
    slug_clean = region_slug.replace("/", "_").replace(".", "")
    cache_file = os.path.join(cache_dir, f"{slug_clean}_p{page}.json")

    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    url = f"https://ostrovok.ru/hotel/{region_slug}/"
    if page > 1:
        url = f"{url}?page={page}"

    try:
        resp = client.get(url, headers=HEADERS, timeout=20.0, follow_redirects=True)
        if resp.status_code != 200:
            logger.warning(f"HTTP {resp.status_code} for {url}")
            return None

        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', resp.text, re.DOTALL)
        if not match:
            logger.warning(f"No __NEXT_DATA__ on {url}")
            return None

        nd = json.loads(match.group(1))
        serp = nd.get("props", {}).get("pageProps", {}).get("serpData", {})
        hotels = serp.get("hotels", [])

        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(hotels, f, ensure_ascii=False, indent=2)

        # Вежливая пауза
        time.sleep(random.uniform(0.35, 0.65))
        return hotels
    except Exception as e:
        logger.error(f"Error fetching {url}: {e}")
        return None
