"""
Dataset Loader: автоматическая подгрузка и распаковка датасета из Yandex Object Storage S3.
Поддерживает:
1. Приватный бакет с ключами через SigV4 (zero-dependency, без внешних тяжелых SDK).
2. Публичный бакет по прямому HTTPS-запросу (если бакет открыт для общего доступа).
3. Версионирование (latest или конкретная версия v1.0.0).
4. Идемпотентность: мгновенный возврат (0 мс), если файл уже присутствует на диске.
"""

import gzip
import hashlib
import hmac
import logging
import os
from datetime import UTC, datetime
from pathlib import Path

import httpx

from ..config import settings

logger = logging.getLogger("dataset_loader")

REGION = "ru-central1"
SERVICE = "s3"


def _build_sigv4_headers(
    host: str,
    key: str,
    access_key: str,
    secret_key: str,
) -> dict[str, str]:
    """Формирует заголовки AWS SigV4 для авторизованного GET-запроса к S3."""
    now = datetime.now(UTC)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    payload_hash = hashlib.sha256(b"").hexdigest()
    canonical_uri = f"/{key}"
    canonical_headers = (
        f"host:{host}\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "host;x-amz-content-sha256;x-amz-date"
    canonical_request = (
        f"GET\n{canonical_uri}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    )

    algorithm = "AWS4-HMAC-SHA256"
    credential_scope = f"{date_stamp}/{REGION}/{SERVICE}/aws4_request"
    string_to_sign = (
        f"{algorithm}\n{amz_date}\n{credential_scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    def sign(k: bytes, msg: str) -> bytes:
        return hmac.new(k, msg.encode("utf-8"), hashlib.sha256).digest()

    k_date = sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = sign(k_date, REGION)
    k_service = sign(k_region, SERVICE)
    k_signing = sign(k_service, "aws4_request")
    signature = hmac.new(
        k_signing, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    auth_header = (
        f"{algorithm} Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    return {
        "x-amz-date": amz_date,
        "x-amz-content-sha256": payload_hash,
        "Authorization": auth_header,
    }


def ensure_dataset_available(
    target_path: str | None = None,
    force: bool = False,
    version: str | None = None,
) -> Path:
    """
    Проверяет наличие локального датасета. Если файл отсутствует или force=True,
    скачивает и распаковывает архив из Yandex S3.
    """
    dest = Path(target_path or settings.DATASET_PATH)
    if not force and dest.exists() and dest.stat().st_size > 1024 * 1024:
        logger.info(f"Локальный датасет уже готов ({dest})")
        return dest

    dest.parent.mkdir(parents=True, exist_ok=True)
    bucket = os.getenv("S3_BUCKET_NAME", "ostrovok2026-dataset-b1g8")
    ver = version or os.getenv("DATASET_VERSION", "latest")
    key = f"datasets/{ver}/hotels.json.gz"
    host = f"{bucket}.storage.yandexcloud.net"
    url = f"https://{host}/{key}"

    access_key = os.getenv("S3_ACCESS_KEY_ID", "")
    secret_key = os.getenv("S3_SECRET_ACCESS_KEY", "")

    headers = {}
    if access_key and secret_key:
        headers = _build_sigv4_headers(host, key, access_key, secret_key)
    else:
        logger.info("Ключи S3 не заданы, попытка прямого публичного скачивания...")

    logger.info(f"Загрузка датасета {ver} из S3 ({url})...")
    with httpx.Client(timeout=45.0, follow_redirects=True) as client:
        resp = client.get(url, headers=headers)
        if resp.status_code != 200:
            raise RuntimeError(
                f"Ошибка загрузки датасета из S3 (HTTP {resp.status_code}): {resp.text[:200]}"
            )
        compressed_data = resp.content

    logger.info(f"Распаковка {len(compressed_data) / (1024*1024):.1f} МБ gzip в {dest}...")
    decompressed = gzip.decompress(compressed_data)
    tmp_path = dest.with_suffix(".tmp")
    with open(tmp_path, "wb") as f:
        f.write(decompressed)
    tmp_path.replace(dest)

    logger.info(f"Датасет успешно подготовлен: {dest.stat().st_size / (1024*1024):.1f} МБ")
    return dest
