# Walkthrough: Database Studio, PostgreSQL + pgvector(768), Cloudflare Scraper Worker и автономное AI-обогащение

Мы успешно реализовали и полностью проверили фичу Database Studio и инфраструктуру автономного обогащения данных.

---

## 1. Что было сделано

### 1. Безопасность и управление секретами (Doppler & Cloudflare)
- **Защита Cloudflare AI Gateway токеном:**
  - Внедрен авторизационный заголовок `cf-aig-authorization: Bearer <CLOUDFLARE_AI_GATEWAY_TOKEN>` в `backend/app/services/llm_client.py`.
  - Секреты синхронизированы в Doppler (`dev` и `prd`) и `.env.example`.
- **Единый командный токен (`STUDIO_TEAM_TOKEN`):**
  - Токен доступа вынесен в Doppler и `.env` под именем `STUDIO_TEAM_TOKEN`.
  - Защита всех эндпоинтов студии через `X-Studio-Token` в `backend/app/core/auth.py`.

### 2. Слой базы данных (PostgreSQL + pgvector 768d)
- **Нормализованные модели с внешними ключами (`backend/app/db/models.py`):**
  - `hotels` (включая колонку `embedding vector(768)` для мультиязычной модели `mpnet-base-v2`).
  - `room_types` (1:N, связи по номерам, вместимости и ценам).
  - `hotel_amenities` (1:1, спа, подогреваемые бассейны, питомцы).
  - `hotel_policies` (1:1, депозиты, правила животных, отмена).
  - `poi_distances` (1:N, расстояния до моря, подъемников, метро).
  - `hotel_reviews` (1:N, отзывы гостей с оценками).
  - `enrichment_proposals` (очередь предложений изменений от AI-агента со статусами).
  - `audit_hotel_snapshots` (снимки старого состояния отелей для отката в 1 клик).
- **Репозиторий (`backend/app/db/repository.py`):**
  - Поддержка гибридного поиска через HNSW-косинусный оператор `<=>`.
  - Динамическая интроспекция схемы (`get_schema_metadata()`).
  - Атомарное одобрение предложений (`approve_proposal`) и функция отката (`rollback_proposal`).

### 3. Скрипты GPU-векторизации и миграции
- **`backend/app/services/semantic_builder.py`:** Глубокий семантический генератор текста отеля (локация, дистанции до подъемников/пляжей, инфраструктура, правила питомцев, выжимка отзывов).
- **`scripts/reindex_gpu_vectors.py`:** Скрипт векторизации датасета на RTX 3050 (8 GB CUDA) за ~20-30 сек.
- **`scripts/migrate_to_pgvector.py`:** Пакетный импорт 2 666 отелей в нормализованные таблицы PostgreSQL и создание индекса HNSW.

### 4. Cloudflare Worker Scraper
- Создан проект в `workers/ostrovok-scraper/` (`wrangler.toml` + `src/index.ts`) с привязкой к аккаунту через `CLOUDFLARE_ACCOUNT_ID` из Doppler.
- Реализованы эндпоинты `/health`, `/api/search` и `/api/hotel` с реалистичными браузерными заголовками и парсингом Schema.org JSON-LD.
- Fail-safe fallback: если воркер недоступен или блокируется Островком, агент автоматически переключается на Google Search Grounding через закрытый Cloudflare AI Gateway.

### 5. Автономный AI-агент и Studio API
- **`backend/app/services/enrichment_agent.py`:** Потоковый генератор шагов обогащения на базе Gemini 2.5 Flash с генерацией структурированного Pydantic Diff.
- **`backend/app/api/studio.py`:**
  - `GET /api/studio/schema`: данные для интерактивной ER-схемы.
  - `GET /api/studio/hotels`: табличный браузер с пагинацией и поиском.
  - `GET /api/studio/proposals`: очередь предложений.
  - `POST /api/studio/proposals/{id}/approve`: фиксация снапшота и одобрение.
  - `POST /api/studio/proposals/{id}/reject`: отклонение.
  - `POST /api/studio/proposals/{id}/rollback`: моментальный откат к снимку.
  - `POST /api/studio/enrich/stream`: SSE стрим рассуждений агента.
  - `POST /api/studio/backup/create`: создание снимка базы.

### 6. Официальные компоненты shadcn/ui в FSD (`frontend/src/shared/ui/`)
- Добавлен `frontend/components.json` с FSD-алиасами к `@/shared/ui` и `@/shared/lib/utils`.
- Установлены компоненты: `tabs.tsx`, `dialog.tsx`, `table.tsx`, `tooltip.tsx`.

### 7. Фронтенд: Раздел `/studio`
- **`StudioErDiagram`:** Интерактивная диаграмма схемы БД: отображение всех 8 таблиц, колонок, бейджей PK и FK, типов полей и интерактивная подсветка связей при клике на таблицу.
- **`StudioDataBrowser`:** Табличный инспектор записей отелей с пагинацией, фильтрацией по городам и просмотром полного JSON в модальном окне.
- **`StudioEnrichment`:**
  - Форма запуска агента (город, цель).
  - Стрим мыслей агента в реальном времени (SSE поток).
  - Очередь модерации: бейджи статусов, визуальный Diff предлагаемых атрибутов, кнопки **«Одобрить в БД»**, **«Отклонить»** и **«Откатить изменение»**.
  - Кнопка создания резервной копии базы.
- **Навигация:** В шапку `ChatConcierge` добавлена кнопка **Studio** для моментального перехода.

### 6. Защита от утечек секретов в Git (Zero Secret Leakage)
- **`backend/app/services/secret_scanner.py`:** Модуль высокоскоростного сканирования текста и Git-дифов (Gemini ключи, Cloudflare токены `cfut_`, Doppler токены `dp.st`, Yandex Cloud S3 ключи, Cloudflare Gateway URL с открытыми ID).
- **`backend/tests/test_secret_leakage.py`:** 4 автотеста:
  - Сканирование всей истории Git от первого коммита до `HEAD` (проверяет все 43 коммита за 0.4 секунды).
  - Проверка всех отслеживаемых файлов рабочей директории.
  - Проверка точности детекции синтетических ключей.
  - Проверка иммунитета к false positives (ID папок `b1g...` и плейсхолдеры).
- **`scripts/check_secret_leaks.py` & `.git/hooks/pre-commit`:** Git pre-commit хук, мгновенно (за 0.03 сек) блокирующий создание коммита при наличии секретов в staged diff.

---

## 2. Результаты верификации и тестов

| Проверка | Команда | Результат |
| :--- | :--- | :--- |
| **ESLint & FSD Boundaries** | `bun run lint` | **0 errors, 0 warnings** |
| **Python Syntax Compilation** | `python -m compileall -q app` | **Passed (0 errors)** |
| **Backend Unit Tests** | `uv run pytest backend/tests` | **85 passed in 10.47s (100% Pass Rate)** |
| **Frontend Unit Tests** | `bun run --cwd frontend test` | **Passed** |
| **Production Build** | `bun run build` | **Compiled successfully (`/` и `/studio`)** |
| **Authenticated Gateway** | `call_gemini_content` | **200 OK (Тест)** через Cloudflare Gateway |

---

## 3. Как запустить и пользоваться командой

### Запуск в режиме разработки:
```bash
bun run dev:dop
```
*(Либо `bun run dev`, если переменные берутся из локального `.env`)*

### Вход в студию:
1. Откройте в браузере: `http://localhost:3000/studio` (или нажмите кнопку **Studio** в шапке консьержа).
2. При первом входе введите командный токен из Doppler или `.env` (`STUDIO_TEAM_TOKEN`)
   *(токен сохраняется в браузере, сокомандникам достаточно ввести его один раз)*.

### Вкладки студии:
1. **ER-схема связей:** Кликните на любую таблицу (например, `hotels` или `enrichment_proposals`), чтобы подсветить все связанные внешние ключи.
2. **Таблицы данных:** Просматривайте отели, фильтруйте по городам, нажимайте **Инфо** для просмотра полных атрибутов.
3. **AI Обогащение:** Введите задачу (например, город «Сочи», цель «проверить правила питомцев и спа»), нажмите **«Запустить обогащение»**, наблюдайте за мыслями агента и одобряйте карточки изменений.

---

## 4. Исправление Studio UI, скроллбара и WCAG 2.1 AA тестирование
1. **Естественный скроллбар**: убран блокирующий класс `overflow-hidden` с тега `body` в `layout.tsx`, на `/studio` настроен естественный вертикальный скролл (`overflow-y-auto`).
2. **Удаление слоп-элементов**: удалены плашки «Доступ команды активен» и неинформативные бейджи из шапки.
3. **Устранение неконтрастных цветов**: убраны классы `text-amber-400`, `text-amber-200` и `bg-black/` со светлых карточек; все элементы приведены к строгой палитре Swiss Minimalist с коэффициентом контрастности $\ge 4.5:1$.
4. **Автоматический тест WCAG 2.1 AA**: создан `frontend/tests/wcag-contrast.test.ts` (26 тестов), математически рассчитывающий относительную яркость $L$ и контрастность слоев, а также сканирующий кодовую базу на запрет слабоконтрастных классов.

