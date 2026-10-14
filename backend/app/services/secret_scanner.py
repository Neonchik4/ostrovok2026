"""High-performance secret scanner for Git history, tracked files, and staged changes."""
import re
import subprocess
from typing import List, Dict, Any, Optional

# Специфические регулярные выражения реальных секретов
SECRET_PATTERNS = [
    (
        "gemini_api_key",
        re.compile(r"AQ\.Ab8[A-Za-z0-9_-]{20,}"),
        "Google AI Studio / Gemini API Key",
    ),
    (
        "cloudflare_api_token",
        re.compile(r"cfut_[a-zA-Z0-9_-]{30,}"),
        "Cloudflare API Token",
    ),
    (
        "cloudflare_gateway_url_with_id",
        re.compile(r"https://gateway\.ai\.cloudflare\.com/v1/[a-f0-9]{32}/"),
        "Cloudflare AI Gateway URL with exposed Account ID",
    ),
    (
        "doppler_token",
        re.compile(r"dp\.(?:st|pt)\.[a-zA-Z0-9._-]{30,}"),
        "Doppler Service or Personal Token",
    ),
    (
        "yandex_s3_secret_key",
        re.compile(r"YCPG[A-Za-z0-9_-]{30,}"),
        "Yandex Cloud Object Storage Secret Access Key",
    ),
    (
        "private_key",
        re.compile(r"-----BEGIN (?:RSA|OPENSSH|EC|PGP|ENCRYPTED|PRIVATE) KEY-----"),
        "Private Key Header",
    ),
]

# Исключения и безопасные паттерны
SAFE_EXCLUSIONS = [
    re.compile(r"your_[a-zA-Z0-9_]+_here"),
    re.compile(r"cfut_your_api_token_here"),
    re.compile(r"dp\.st\.prd\.xxxx"),
    re.compile(r"your_account_id"),
    re.compile(r"your_gateway_name"),
    re.compile(r"test_[a-zA-Z0-9_]+"),
    re.compile(r"synthetic_[a-zA-Z0-9_]+"),
]


def _is_safe(match_str: str, filename: str) -> bool:
    """Проверяет, является ли найденная строка безопасным плейсхолдером или тестом."""
    # .env.example разрешен для плейсхолдеров
    if ".env.example" in filename:
        for p in SAFE_EXCLUSIONS:
            if p.search(match_str):
                return True

    # Тестовые файлы с проверками самого сканера
    if "test_secret_leakage.py" in filename:
        return True

    # Проверка общих плейсхолдеров
    for p in SAFE_EXCLUSIONS:
        if p.search(match_str):
            return True

    return False


def mask_secret(secret: str) -> str:
    """Маскирует секрет для безопасного отображения в отчетах."""
    if len(secret) <= 8:
        return "****"
    return f"{secret[:4]}...{secret[-4:]}"


def scan_text(text: str, filename: str = "") -> List[Dict[str, Any]]:
    """Сканирует текст на наличие секретов по скомпилированным регулярным выражениям."""
    findings = []
    for pattern_id, regex, desc in SECRET_PATTERNS:
        # Пропускаем проверку gateway url для .env файлов
        if pattern_id == "cloudflare_gateway_url_with_id" and (
            filename.endswith(".env") or filename.endswith(".env.local") or ".env.example" in filename
        ):
            continue

        for match in regex.finditer(text):
            val = match.group()
            if not _is_safe(val, filename):
                findings.append(
                    {
                        "type": pattern_id,
                        "description": desc,
                        "matched_snippet": mask_secret(val),
                        "filename": filename,
                    }
                )
    return findings


def scan_git_history(max_commits: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Сканирует историю коммитов через git log -p.
    Возвращает список обнаруженных утечек с хэшами коммитов и описанием.
    """
    cmd = ["git", "log", "-p", "--no-color"]
    if max_commits:
        cmd.extend(["-n", str(max_commits)])

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
    except Exception as e:
        print(f"[SecretScanner Warning] Не удалось выполнить git log: {e}")
        return []

    diff_lines = proc.stdout.splitlines()
    findings = []
    current_commit = "HEAD"
    current_file = ""

    for line in diff_lines:
        if line.startswith("commit "):
            current_commit = line.split()[1][:8]
        elif line.startswith("+++ b/"):
            current_file = line[6:]
        elif line.startswith("+") and not line.startswith("+++"):
            added_content = line[1:]
            matches = scan_text(added_content, current_file)
            for m in matches:
                m["commit"] = current_commit
                findings.append(m)

    return findings


def scan_staged_changes() -> List[Dict[str, Any]]:
    """Сканирует только застейдженные файлы перед коммитом (git diff --cached)."""
    try:
        proc = subprocess.run(
            ["git", "diff", "--cached", "--no-color"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
    except Exception as e:
        print(f"[SecretScanner Warning] Не удалось выполнить git diff: {e}")
        return []

    findings = []
    current_file = ""
    for line in proc.stdout.splitlines():
        if line.startswith("+++ b/"):
            current_file = line[6:]
        elif line.startswith("+") and not line.startswith("+++"):
            added_content = line[1:]
            matches = scan_text(added_content, current_file)
            findings.extend(matches)

    return findings


def scan_tracked_files() -> List[Dict[str, Any]]:
    """Сканирует все отслеживаемые Git файлы в текущей рабочей директории."""
    try:
        proc = subprocess.run(
            ["git", "ls-files"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
    except Exception as e:
        print(f"[SecretScanner Warning] Не удалось выполнить git ls-files: {e}")
        return []

    findings = []
    files = [f.strip() for f in proc.stdout.splitlines() if f.strip()]
    for filepath in files:
        # Пропускаем бинарники и архивные файлы
        if any(filepath.endswith(ext) for ext in [".png", ".jpg", ".ico", ".gz", ".zip", ".sqlite3", ".pyc"]):
            continue
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            matches = scan_text(content, filepath)
            findings.extend(matches)
        except Exception:
            continue

    return findings
