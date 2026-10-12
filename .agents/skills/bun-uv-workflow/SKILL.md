---
name: bun-uv-workflow
description: Set up, run, test, and maintain Ostrovok2026 with Bun and uv. Use for dependency installation, lockfiles, Python environments, local startup, CI, Docker toolchain changes, or errors from bun and uv lock/sync/run. Preserve the existing Node.js and Python application runtimes.
---

# Bun и uv: рабочий процесс проекта

Корень репозитория находится в `../../../` относительно этого `SKILL.md`. Все команды ниже выполняются из корня, если явно не указано иное.

Перед изменениями прочитай `../../../AGENTS.md`, `../../../package.json`, `../../../pyproject.toml` и профильные правила в `../../rules/`. Проверь `git status --short`; не откатывай чужие правки. Новые проверки добавляй до реализации.

## Разделение ответственности

- **Bun** — менеджер JavaScript-пакетов и запуск команд. Версия закреплена в `../../../.bun-version` и `packageManager` обоих `package.json`.
- **Node.js 22+** — runtime для Next.js, Vitest и служебных JS-скриптов. Не добавляй `--bun`; `bun run test` не равно `bun test`.
- **uv** — менеджер Python-зависимостей и корневой `.venv`. Манифест и lock находятся в корне, а не в `backend/`.
- **Python 3.11** — версия из `../../../.python-version`, согласованная с Docker. Не подменяй ее системным Python.
- Сохраняй `env = false` и `[run] bun = false` в обоих `bunfig.toml`: загрузкой `.env` по-прежнему управляют Next.js и Python.

## Установка и запуск

```bash
bun run setup
bun run dev
```

Отдельная установка:

```bash
bun run setup:front
bun run setup:back
```

`setup:front` устанавливает два независимых Bun-проекта с `--frozen-lockfile`. Не превращай их в workspace попутно с другой задачей.

`setup:back` выполняет `uv sync --locked`. uv сам создаст `.venv` и найдет Python 3.11; активировать окружение вручную не нужно. Перед синхронизацией уже существующей среды проверь `uv sync --locked --dry-run`. Если в ней есть пользовательские утилиты вне зависимостей проекта, сохрани их через `uv sync --locked --inexact`, не добавляя эти утилиты в манифест приложения.

Отдельный запуск:

```bash
bun run dev:front
bun run dev:back
bun run dev:static-back
```

Не запускай эти три команды одновременно: это альтернативы. Проверь занятость портов 3000 и 8000 до запуска и не останавливай чужие процессы. Для прямого запуска Python из `backend/` используй `uv run --project .. --locked python -m <module>`.

## Изменение зависимостей

- Фронтенд: `bun add --cwd frontend <package>`, для dev-зависимости добавь `--dev`.
- Корневые JS-инструменты: `bun add --dev <package>`.
- Python runtime: `uv add <package>`; тестовые инструменты: `uv add --dev <package>`.
- Обновление lock после ручного изменения Python-манифеста: `uv lock`; проверка без изменения: `uv lock --check`.
- Сохраняй манифесты и все три lock-файла в Git. Не возвращай `package-lock.json`, `bun.lockb` или отдельный `requirements.txt`.
- Не выполняй `bun update` или `uv lock --upgrade` без отдельной задачи на обновление библиотек.
- Не меняй `chromadb==1.5.9` без проверки совместимости существующих индексов. Сохраняй явный CPU-only индекс PyTorch на Linux; не подтягивай CUDA на CPU-сервер.
- Миграция менеджера пакетов не должна менять компоненты UI, SSE-контракт, бизнес-логику, датасет или индексы.

## Проверки

```bash
uv lock --check
bun run lint
bun run test
bun run test:deploy
bun run build
```

- Pytest запускается через uv, Vitest — через Node.js. Не скрывай ненулевые коды завершения обертками.
- `lint` проверяет ESLint/FSD и синтаксис Python; это не полноценная статическая проверка типов Python.
- После изменения запуска проверь HTTP-страницу и API/SSE через настоящий бэкенд. Не добавляй моки в runtime ради smoke-проверки.
- Docker-конфигурационные тесты требуют Docker CLI, но не Engine. Реальная сборка требует работающего Engine; явно сообщи, если ее не удалось проверить.
- Бэкенд собирается командой `docker build -f backend/Dockerfile .`: контекст — корень, установка — `uv sync --locked --no-dev`. Проверь также контекст в Compose и release workflow.
- Сохраняй non-root запуск, один worker бэкенда, Node.js standalone-сервер фронтенда и исключение секретов/кэшей через `.dockerignore`.
- Не печатай `.env`, API-ключи или необработанную конфигурацию с секретами. Перед завершением проверь `git diff --check` и `git status --short`.

## Если uv не находит pyproject.toml

Проверь, что команда выполняется в корне этого репозитория и `pyproject.toml` присутствует. Из `backend/` допустимо `uv lock --project ..`. Не создавай второй проект через `uv init` внутри бэкенда: иначе появятся отдельные lock-файл и окружение.
