"""
CLI-скрипт для скачивания и обновления датасета отелей из Yandex S3.

Использование:
  python scripts/download_dataset.py              # Проверить и скачать при отсутствии
  python scripts/download_dataset.py --force      # Принудительно перезагрузить latest
  python scripts/download_dataset.py --version v1.0.0  # Скачать конкретную версию
"""

import argparse
import logging
import os
import sys

# Добавляем backend в sys.path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))

# Подгружаем переменные из .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
except ImportError:
    pass

from app.services.dataset_loader import ensure_dataset_available

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("download_dataset")


def main():
    parser = argparse.ArgumentParser(description="Скачивание датасета отелей из Yandex S3")
    parser.add_argument("--force", action="store_true", help="Принудительно перезагрузить датасет")
    parser.add_argument("--version", type=str, default=None, help="Версия датасета (по умолчанию: latest)")
    parser.add_argument("--path", type=str, default=None, help="Путь для сохранения файла")
    args = parser.parse_args()

    default_path = args.path or os.path.join(ROOT_DIR, "outputs", "hotels.json")
    try:
        path = ensure_dataset_available(
            target_path=default_path,
            force=args.force,
            version=args.version,
        )
        logger.info(f"Датасет готов к работе: {path}")
    except Exception as e:
        logger.error(f"Не удалось скачать датасет: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
