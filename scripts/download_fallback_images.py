"""
Download Fallback Images from Real Ostrovok CDN
Берет 5 реальных фото из каждой категории отелей (горы, море, центр, природа, номера)
напрямую из outputs/hotels_dataset.json и сохраняет в frontend/public/hotels/.
Размер каждого фото ~40-60 Кб. Суммарный объем бандла: ~1.2 Мб.
"""

import os
import json
import httpx
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("img_downloader")

DATASET_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs", "hotels_dataset.json")
BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public", "hotels")

def download_ostrovok_fallbacks():
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        hotels = json.load(f)

    categories = {
        "mountains": [],
        "sea": [],
        "center": [],
        "nature": [],
        "rooms": [],
    }

    for h in hotels:
        atype = h.get("area_type", "center")
        imgs = h.get("image_urls", [])
        if not imgs or not imgs[0].startswith("https://cdn.ostrovok.ru"):
            continue

        if atype in categories and len(categories[atype]) < 5:
            categories[atype].append(imgs[0])

        if len(imgs) > 1 and len(categories["rooms"]) < 5 and imgs[1].startswith("https://cdn.ostrovok.ru"):
            categories["rooms"].append(imgs[1])

    client = httpx.Client(timeout=10.0, headers={"User-Agent": "Mozilla/5.0"})
    total = 0

    for cat, urls in categories.items():
        cat_dir = os.path.join(BASE_DIR, cat)
        os.makedirs(cat_dir, exist_ok=True)
        for i, url in enumerate(urls, 1):
            out_file = os.path.join(cat_dir, f"{i}.jpg")
            if os.path.exists(out_file) and os.path.getsize(out_file) > 5000:
                total += 1
                continue
            try:
                resp = client.get(url)
                if resp.status_code == 200:
                    with open(out_file, "wb") as f:
                        f.write(resp.content)
                    total += 1
                    logger.info(f"Сохранено: {cat}/{i}.jpg ({len(resp.content)//1024} Кб)")
            except Exception as e:
                logger.warning(f"Ошибка загрузки {url}: {e}")

    logger.info(f"Готово! Сохранено {total} локальных резервных изображений в frontend/public/hotels/")

if __name__ == "__main__":
    download_ostrovok_fallbacks()
