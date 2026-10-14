"""Pre-commit and CI secret leak checker script."""
import sys
from pathlib import Path

# Добавляем корень проекта и backend в sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "backend"))

from backend.app.services.secret_scanner import (
    scan_staged_changes,
    scan_git_history,
    scan_tracked_files,
)


def main():
    check_all = "--all" in sys.argv
    print("[Secret Check] Запуск сканирования на утечки секретов...")

    if check_all:
        print("  Режим: Полный аудит всей истории Git и отслеживаемых файлов...")
        leaks = scan_git_history() + scan_tracked_files()
    else:
        print("  Режим: Проверка подготовленных к коммиту изменений (staged diff)...")
        leaks = scan_staged_changes()

    if leaks:
        print("\n=======================================================")
        print("[CRITICAL ERROR] ОБНАРУЖЕНА ПОПЫТКА УТЕЧКИ СЕКРЕТОВ В GIT!")
        print("=======================================================")
        for leak in leaks:
            loc = f"Commit {leak.get('commit')}, " if "commit" in leak else ""
            print(f"- {loc}Файл: {leak.get('filename')}")
            print(f"  Тип: {leak.get('description')}")
            print(f"  Фрагмент: {leak.get('matched_snippet')}")
        print("\nКоммит заблокирован. Вынесите секреты в Doppler или локальный .env файл.")
        sys.exit(1)

    print("[Secret Check OK] Утечек секретов не обнаружено. Изменения безопасны.")
    sys.exit(0)


if __name__ == "__main__":
    main()
