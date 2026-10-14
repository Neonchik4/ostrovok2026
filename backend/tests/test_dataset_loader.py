import gzip
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.dataset_loader import _build_sigv4_headers, ensure_dataset_available


def test_build_sigv4_headers():
    headers = _build_sigv4_headers(
        host="test-bucket.storage.yandexcloud.net",
        key="datasets/latest/hotels.json.gz",
        access_key="test_access_key",
        secret_key="test_secret_key",
    )
    assert "x-amz-date" in headers
    assert "x-amz-content-sha256" in headers
    assert "Authorization" in headers
    assert headers["Authorization"].startswith("AWS4-HMAC-SHA256 Credential=test_access_key/")


def test_ensure_dataset_available_existing(tmp_path: Path):
    dest = tmp_path / "hotels.json"
    dummy_data = b"x" * (2 * 1024 * 1024)  # 2 MB
    dest.write_bytes(dummy_data)

    res = ensure_dataset_available(target_path=str(dest), force=False)
    assert res == dest
    assert dest.read_bytes() == dummy_data


def test_ensure_dataset_available_download(tmp_path: Path):
    dest = tmp_path / "hotels.json"
    sample_hotels = [{"id": "h1", "name": "Hotel Test", "city": "Москва"}]
    raw_json = json.dumps(sample_hotels).encode("utf-8")
    compressed = gzip.compress(raw_json)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = compressed

    with patch("httpx.Client.get", return_value=mock_resp):
        res = ensure_dataset_available(target_path=str(dest), force=True)

    assert res == dest
    assert dest.exists()
    loaded = json.loads(dest.read_text(encoding="utf-8"))
    assert loaded == sample_hotels
