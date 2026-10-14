"""Unit tests verifying zero secret leakage in git commit history and tracked repository files."""
import pytest
from app.services.secret_scanner import (
    scan_text,
    scan_git_history,
    scan_tracked_files,
)


def test_no_secrets_in_git_history():
    """Проверяет, что ни в одном коммите за всю историю проекта нет утекших секретов."""
    leaks = scan_git_history()
    if leaks:
        leak_reports = [
            f"Commit {l.get('commit')}, File '{l.get('filename')}': {l.get('description')} ({l.get('matched_snippet')})"
            for l in leaks
        ]
        pytest.fail("Обнаружена утечка секретов в истории Git:\n" + "\n".join(leak_reports))


def test_no_secrets_in_tracked_files():
    """Проверяет, что во всех отслеживаемых Git файлах отсутствуют секреты."""
    leaks = scan_tracked_files()
    if leaks:
        leak_reports = [
            f"File '{l.get('filename')}': {l.get('description')} ({l.get('matched_snippet')})"
            for l in leaks
        ]
        pytest.fail("Обнаружена утечка секретов в отслеживаемых файлах:\n" + "\n".join(leak_reports))


def test_scanner_detects_synthetic_secrets():
    """Проверяет точность детекции реальных сигнатур секретов сканером."""
    # Тестовый ключ Gemini
    gemini_sample = "AQ" + ".Ab8" + "FakeKeyForTesting1234567890"
    matches = scan_text(gemini_sample, "sample.py")
    assert any(m["type"] == "gemini_api_key" for m in matches)

    # Тестовый токен Cloudflare
    cf_sample = "cf" + "ut_" + "FakeToken1234567890abcdef1234567890"
    matches = scan_text(cf_sample, "sample.py")
    assert any(m["type"] == "cloudflare_api_token" for m in matches)

    # Тестовый токен Doppler
    doppler_sample = "dp" + ".st.dev." + "FakeDopplerToken1234567890abcdef12"
    matches = scan_text(doppler_sample, "sample.py")
    assert any(m["type"] == "doppler_token" for m in matches)

    # Тестовый Cloudflare Gateway URL с открытым ID в коде
    gw_sample = "https://" + "gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/gw/ai"
    matches = scan_text(gw_sample, "backend/app/main.py")
    assert any(m["type"] == "cloudflare_gateway_url_with_id" for m in matches)


def test_scanner_ignores_folder_ids_and_placeholders():
    """Проверяет отсутствие ложных срабатываний на ID папок Yandex Cloud и шаблонные строки."""
    clean_sample = """
    folder-id: b1g8ic3c05495oc68b7d
    cloud-id: b1g0jnldg1g4f798hj7v
    zone: ru-central1-a
    GEMINI_API_KEYS=your_gemini_api_key_here
    CLOUDFLARE_AI_GATEWAY_TOKEN=cfut_your_api_token_here
    """
    matches = scan_text(clean_sample, ".env.example")
    assert len(matches) == 0, f"Ложное срабатывание на: {matches}"
