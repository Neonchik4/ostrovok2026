"""
ETL-скрипт глубокого сбора отзывов с Ostrovok.ru
Загружает до 200 реальных отзывов на каждый отель через официальный API эндпоинт,
фильтрует короткие реплики (<50 символов), агрегирует метрики и сохраняет:
1. outputs/hotels/{hotel_id}.json — полный архив отеля с массивом отзывов
2. outputs/hotels_catalog.json — легковесный боевой каталог для бэкенда
"""

import os
import sys
import json
import time
import random
import logging
import asyncio
from typing import Dict, List, Any, Optional
import httpx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from review_metrics import extract_review_metrics

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("reviews_fetcher")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DATASET = os.path.join(ROOT_DIR, "outputs", "hotels_dataset.json")
HOTELS_DIR = os.path.join(ROOT_DIR, "outputs", "hotels")
CATALOG_PATH = os.path.join(ROOT_DIR, "outputs", "hotels_catalog.json")

REVIEWS_API_URL = "https://ostrovok.ru/hotel/search/v1/site/reviews"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Referer": "https://ostrovok.ru/",
}


async def fetch_single_hotel_reviews(
    client: httpx.AsyncClient,
    hotel_id: str,
    max_reviews: int = 200,
    semaphore: Optional[asyncio.Semaphore] = None,
) -> Optional[Dict[str, Any]]:
    """Делает запрос к API отзывов Островка с обработкой ошибок и задержкой."""
    if semaphore:
        async with semaphore:
            return await _do_fetch(client, hotel_id, max_reviews)
    return await _do_fetch(client, hotel_id, max_reviews)


async def _do_fetch(client: httpx.AsyncClient, hotel_id: str, max_reviews: int) -> Optional[Dict[str, Any]]:
    params = {
        "hotel": hotel_id,
        "page": 1,
        "page_size": max_reviews,
        "lang": "ru",
        "sort": "relevance_desc",
    }
    # Вежливая пауза между запросами
    await asyncio.sleep(random.uniform(0.35, 0.65))

    try:
        resp = await client.get(REVIEWS_API_URL, params=params, headers=DEFAULT_HEADERS, timeout=15.0)
        if resp.status_code == 200:
            return resp.json()
        elif resp.status_code == 404:
            return {"reviews": [], "total": 0}
        else:
            logger.warning(f"Отель {hotel_id}: HTTP {resp.status_code}")
            return None
    except Exception as e:
        logger.error(f"Отель {hotel_id}: ошибка запроса: {e}")
        return None


async def process_hotels(hotels: List[Dict[str, Any]], max_concurrency: int = 4, force: bool = False) -> None:
    os.makedirs(HOTELS_DIR, exist_ok=True)
    semaphore = asyncio.Semaphore(max_concurrency)

    catalog_entries = []
    total = len(hotels)
    logger.info(f"Старт обработки {total} отелей (concurrency={max_concurrency})...")

    async with httpx.AsyncClient() as client:
        for idx, h in enumerate(hotels, 1):
            h_id = h.get("id")
            if not h_id:
                continue

            dest_path = os.path.join(HOTELS_DIR, f"{h_id}.json")
            hotel_data = dict(h)

            # Если файл уже существует и не форсируем — читаем из диска
            if os.path.exists(dest_path) and not force:
                try:
                    with open(dest_path, "r", encoding="utf-8") as f:
                        hotel_data = json.load(f)
                except Exception:
                    pass
            else:
                raw_api_resp = await fetch_single_hotel_reviews(client, h_id, max_reviews=200, semaphore=semaphore)
                if raw_api_resp and "reviews" in raw_api_resp:
                    metrics = extract_review_metrics(raw_api_resp["reviews"])
                    hotel_data["reviews"] = metrics["reviews"]
                    hotel_data["reviews_summary"] = metrics["reviews_summary"]
                    hotel_data["total_ostrovok_reviews"] = raw_api_resp.get("total", len(metrics["reviews"]))
                else:
                    hotel_data["reviews"] = []

                # Сохраняем индивидуальный файл отеля
                with open(dest_path, "w", encoding="utf-8") as f:
                    json.dump(hotel_data, f, ensure_ascii=False, indent=2)

                rev_count = len(hotel_data.get("reviews", []))
                logger.info(f"[{idx}/{total}] {hotel_data.get('name')} ({hotel_data.get('city')}): собрано {rev_count} содержательных отзывов")

            # Формируем запись для каталога: сохраняем все поля схемы, но оставляем только топ-5 отзывов
            cat_entry = dict(hotel_data)
            cat_entry["reviews"] = (hotel_data.get("reviews") or [])[:5]
            catalog_entries.append(cat_entry)

    # Сохраняем итоговый компактный каталог
    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog_entries, f, ensure_ascii=False, indent=2)

    cat_size_mb = round(os.path.getsize(CATALOG_PATH) / (1024 * 1024), 2)
    logger.info(f"Успешно сохранен компактный каталог: {CATALOG_PATH} ({len(catalog_entries)} отелей, {cat_size_mb} МБ)")


def main():
    limit = None
    force = False
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg.startswith("--limit="):
                limit = int(arg.split("=")[1])
            elif arg == "--force":
                force = True

    if not os.path.exists(SOURCE_DATASET):
        logger.error(f"Файл {SOURCE_DATASET} не найден! Проверьте путь.")
        return

    with open(SOURCE_DATASET, "r", encoding="utf-8") as f:
        hotels = json.load(f)

    if limit:
        hotels = hotels[:limit]
        logger.info(f"Режим тестирования: ограничение {limit} отелей")

    asyncio.run(process_hotels(hotels, max_concurrency=4, force=force))


if __name__ == "__main__":
    main()
