# Ostrovok AI Concierge

> Каркас проекта для команды «О!Хакатон 2026» (Компания «Островок» / Ostrovok.tech).  
> Трек №2: «О!дин запрос» (AI-агент для умного поиска и бронирования отелей).  
> Слоган: «Скажи, куда хочешь отправиться. Остальное устроит агент».

---

## Описание проекта

Ostrovok AI Concierge — интеллектуальный ассистент для планирования поездок и бронирования отелей. Сервис принимает естественные разговорные запросы текстом или голосом, анализирует контекст поездки, выполняет гибридный поиск по реальной базе отелей и формирует прозрачный чек без скрытых комиссий.

### Ключевые возможности:
* **Естественный диалог и голосовой ввод:** поддержка ввода произвольных пожеланий текстом или голосом через Web Speech API («Красная Поляна с собакой и теплым бассейном до 20 000 руб»).
* **Двухэтапный гибридный поиск (Hybrid Retrieval):**
  1. Семантический векторный поиск через ChromaDB / PostgreSQL `pgvector(768)` (`sentence-transformers/paraphrase-multilingual-mpnet-base-v2` и Gemini Aspects 768d).
  2. Жесткая скалярная фильтрация и калиброванный Match Score (65%..98%) по реальному датасету из 2 666 отелей по 19 направлениям.
* **Честное разложение соответствия (Decomposed Match Score):** раскрытие обоснования скоринга по кодовым фактам (`code_verified`), семантике отзывов (`semantic_match`) и допустимым компромиссам (`relaxed_compromise`).
* **Smart Relaxation с явными компромиссами:** при отсутствии точных совпадений карточки открыто сообщают о вынужденных уступках (например, «Бюджет превышен на 1 400 ₽»).
* **Аспектное профилирование и экстрактор цитат отзывов:** автоматическое выявление конкретных преимуществ и честных нюансов отеля по реальным отзывам гостей (`scripts/tag_reviews.py`).
* **Строгий детерминизм бизнес-логики:** математика чека (ночи, базовая стоимость, доплата за питомцев, курортный сбор) считается строго детерминированным кодом, исключая галлюцинации LLM.
* **Каскадный отказоустойчивый контур LLM:** `gemini-3.5-flash-lite` -> `gemini-3.5-flash` -> `gemini-flash-lite-latest` -> детерминированный локальный генератор.
* **Прозрачный ход мыслей (Thinking Stream):** трансляция каждого этапа анализа и поиска в реальном времени через Server-Sent Events (SSE).
* **Современный интерфейс:** Swiss Minimalist дизайн на Next.js 14 (Feature-Sliced Design), протестированный на WCAG 2.1 AA (контрастность $\ge 4.5:1$, Zero-Emoji), со сплит-экраном (чат-агент 480px + канвас отелей) и интерактивной Database AI Studio (`/studio`).

---

## Как подключить (Конфигурация)

Для генерации ответов и извлечения параметров используется Google Gemini API.

1. Получите бесплатный API-ключ в сервисе Google AI Studio: [https://aistudio.google.com/](https://aistudio.google.com/)
2. Создайте файл `.env` в корневом каталоге проекта на основе образца:
   ```bash
   cp .env.example .env
   ```
3. Укажите полученный ключ в файле `.env`:
   ```env
   GEMINI_API_KEY=ваш_ключ_gemini_api
   ```
   *Примечание:* При отсутствии ключа приложение автоматически переключается на встроенный детерминированный офлайн-экстрактор, сохраняя полную работоспособность поиска по 2 666 отелям.

---

## Секреты команды через Doppler

Единый источник правды по секретам — Doppler (проект `ostrovok2026`). Локальная разработка берёт значения из конфига `dev` и **не требует файла `.env`**; `.env.example` остаётся образцом и резервным вариантом.

### Первый запуск у разработчика

1. Установите Doppler CLI ([cli.doppler.com](https://cli.doppler.com)) и войдите:
   ```bash
   doppler login
   ```
2. Запустите приложение со всеми секретами команды:
   ```bash
   bun run dev:dop
   ```
   Команда сама передаёт `--project ostrovok2026 --config dev`, поэтому доступны общие dev-секреты без ручного копирования `.env`.

### Доступ участников (только чтение)

Участники получают **read-only service token** конфига `dev` (через дашборд: `Project -> dev -> Access -> Generate`, либо CLI `doppler configs tokens create <name> --project ostrovok2026 --config dev --access read`). Далее достаточно:

```bash
# Git Bash / Linux / macOS
export DOPPLER_TOKEN=dp.st.dev.xxxx
export HISTIGNORE='export DOPPLER_TOKEN*'
bun run dev
```

```powershell
# PowerShell
$env:DOPPLER_TOKEN = "dp.st.dev.xxxx"
bun run dev
```

Токен читает конфиг `dev` и не имеет прав на запись. Токены `prd` участникам не выдаются.

### Production (`prd`)

Конфиг `prd` содержит Gemini/S3-ключи, `ACME_EMAIL`, `APP_ENV=production`, `HOST=0.0.0.0`, `PORT=8000` и `BACKEND_URL=http://backend:8000`, но **не содержит `DOMAIN`**: домен задаётся отдельно на хосте, чтобы `localhost` из dev никогда не попал в разметку Traefik. Перед первым деплоем задайте домен одним из способов:

```bash
doppler secrets set DOMAIN=app.example.com --config prd
# либо оставьте DOMAIN в .env на сервере — compose требует его явно
```

Бэкенд и оба контейнера запускаются только с `APP_ENV=production`: иначе сработает `runtime_guard`/`docker-compose.yml` и старт будет остановлен.

### Защита от запуска dev-режима на production

Несколько независимых барьеров не дают dev-профилю попасть на прод:

* `bun run dev` и `bun run dev:static-back` сначала выполняют `scripts/guard-dev-environment.mjs`: запуск блокируется при `NODE_ENV=production`, `APP_ENV`, отличном от `development`, нелокальном `DOMAIN`, Doppler-конфиге `prd`/`stg` или запуске внутри Docker.
* `docker-compose.yml` жёстко задаёт `APP_ENV=production` для обоих контейнеров, потому сервисы не могут унаследовать dev-профиль.
* Бэкенд при старте вызывает `runtime_guard`: в контейнере допускается только `APP_ENV=production`.
* Frontend `environment-guard.mjs` запрещает production-сборку с dev-профилем и dev-сервер с production-профилем.

### Деплой на VPS (GHCR + GitHub Actions)

Production-образы собираются в CI и публикуются как **приватные** пакеты в GitHub Container Registry (`release.yml`), а на сервер их раскатывает workflow `deploy.yml` по SSH — без ручной подтяжки и без сборки на самой VM. Пошаговый рунбук (создание VPS, статический IP, SSH, GHCR-логин, Doppler `prd`, GitHub-секреты, проверка и откат) — в [DEPLOY.md](DEPLOY.md).

---

## Что нужно для старта

Перед началом работы убедитесь, что в системе установлены:
* **Bun** версии **1.3.13** (закреплена в `.bun-version` и `packageManager`);
* **Node.js** версии **22 LTS** или выше — среда исполнения Next.js, Vitest и служебных скриптов;
* **uv** версии **0.12.5** или выше — управление Python-зависимостями и окружением;
* **Python 3.11** — закреплен в `.python-version`, при необходимости устанавливается через uv;
* **Git**.

---

## Команды для старта

### 1. Клонирование репозитория
```bash
git clone https://github.com/Neonchik4/ostrovok2026.git
cd ostrovok2026
```

### 2. Python через uv
Команды выполняются из корня репозитория, где находятся `pyproject.toml` и `uv.lock`:
```bash
uv python install
```
uv использует Python 3.11 из `.python-version`, как и Docker. При установке зависимостей он создаст корневую `.venv` или использует уже существующую совместимую среду. Вручную создавать и активировать окружение не требуется ни в PowerShell, ни в Linux/macOS.

### 3. Установка всех зависимостей
Установка всех пакетов (инструменты корня, Next.js фронтенд и FastAPI бэкенд) выполняется одной командой:
```bash
bun run setup
```
*Под капотом запускается:* `bun run setup:front && bun run setup:back`.

Только Python-зависимости: `bun run setup:back` или `uv sync --locked`. Тестовые инструменты входят в группу `dev`, но не в production-образ. По умолчанию `uv sync` удаляет лишние пакеты из `.venv`; при переходе с существующего окружения используйте `uv sync --locked --inexact`, если нужно сохранить установленные отдельно утилиты.

Если бэкенд уже настроен, установите только JavaScript-зависимости корня и фронтенда:
```bash
bun run setup:front
```
Эта команда устанавливает пакеты строго по `bun.lock` и `frontend/bun.lock` с флагом `--frozen-lockfile`, не меняя их версии. Для добавления зависимости используйте `bun add --cwd frontend <package>` (для dev-зависимости добавьте `--dev`) и сохраняйте обновленный `frontend/bun.lock` в Git. Не смешивайте `npm install` и `bun install`.

Bun используется как менеджер пакетов и команд. Next.js и Vitest продолжают работать на Node.js; прикладной код бэкенда остается на Python. Команды бэкенда используют `uv run --locked` и корневую `.venv`, а не случайный системный Python. Конфигурация `bunfig.toml` отключает подмену Node.js и предварительную загрузку `.env`: окружение по-прежнему загружают сами Next.js и бэкенд.

Python-зависимости добавляйте из корня через `uv add <package>` или `uv add --dev <package>`. Сохраняйте `pyproject.toml` вместе с `uv.lock` в Git. `uv lock` обновляет lock-файл после изменения манифеста, `uv lock --check` проверяет его актуальность, а `uv sync --locked` устанавливает зафиксированные версии. Не запускайте `uv lock --upgrade` без отдельной задачи на обновление библиотек; `chromadb==1.5.9` закреплен для совместимости существующих индексов.

### 4. Запуск приложения в режиме разработки
Основная команда запускает параллельно фронтенд и бэкенд в режиме hot-reload:
```bash
bun run dev
```

Прежняя команда `npm run dev` также работает, но теперь вызывает Bun. Для нового запуска используйте `bun run dev`.

После успешного запуска приложение доступно по адресам:
* **Веб-интерфейс (Next.js):** [http://localhost:3000](http://localhost:3000)
* **Бэкенд API (FastAPI):** [http://127.0.0.1:8000](http://127.0.0.1:8000)
* **Интерактивная документация Swagger/OpenAPI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## Дополнительные полезные команды

| Команда | Назначение |
| :--- | :--- |
| `bun run dev` | Запуск фронтенда и бэкенда в hot-reload |
| `bun run dev:dop` | То же, но секреты приходят из Doppler (`--config dev`) |
| `bun run dev:front` | Запуск только фронтенда (порт 3000) |
| `bun run dev:back` | Запуск только бэкенда (порт 8000 c reload) |
| `bun run dev:static-back` | Запуск фронтенда в hot-reload, бэкенда — в статичном режиме |
| `bun run setup:front` | Установка зависимостей корня и фронтенда без изменения Python-окружения |
| `bun run setup:back` | Установка Python-зависимостей по `uv.lock` в корневую `.venv` |
| `bun run test` | Запуск всех тестов Vitest и Pytest |
| `bun run test:front` | Запуск тестов фронтенда (Vitest, не встроенный `bun test`) |
| `bun run test:back` | Запуск тестов бэкенда (Pytest) |
| `bun run test:deploy` | Проверка Docker Compose-конфигурации; нужен Docker CLI |
| `bun run lint` | Проверка ESLint, FSD Boundaries и синтаксиса Python |
| `bun run build` | Production-сборка фронтенда Next.js |

В `frontend/Dockerfile` установка и сборка также используют Bun и frozen lockfile. Production-контейнер, standalone-сервер, healthcheck и маршрутизация API остаются на прежней конфигурации Node.js/Traefik.

`backend/Dockerfile` устанавливает тот же `uv.lock` через `uv sync --locked --no-dev`. На Linux выбирается CPU-only PyTorch без CUDA. Контекст сборки бэкенда — корень репозитория (`docker build -f backend/Dockerfile .`); корневая `.dockerignore` пропускает только манифесты и исходники бэкенда, исключая секреты, датасеты и локальную `.venv`. CI использует те же lock-файлы.

---

## Архитектура и правила для агентов

* [AGENTS.md](file:///c:/Users/vanya/OneDrive/Desktop/ostrovok2026/AGENTS.md) — главный архитектурный манифест проекта и стандарты команды.
* [.agents/RULES.md](file:///c:/Users/vanya/OneDrive/Desktop/ostrovok2026/.agents/RULES.md) — свод операционных инженерных правил:
  * `.agents/rules/frontend.md` — архитектура FSD, запрет HEX, Zero-Emoji;
  * `.agents/rules/backend.md` — модульность SRP, каскад моделей, детерминизм чека;
  * `.agents/rules/security-and-testing.md` — Secure by Design, TDD, запрет моков в рантайме;
  * `.agents/rules/git-workflow.md` — регламент Git и актуализация `.gitignore`.
* [.agents/skills/bun-uv-workflow/SKILL.md](.agents/skills/bun-uv-workflow/SKILL.md) — установка, запуск, обновление зависимостей и проверки Bun/uv без смены среды исполнения приложения.

