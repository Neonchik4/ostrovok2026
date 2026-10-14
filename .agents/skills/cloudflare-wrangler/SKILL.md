---
name: cloudflare-wrangler
description: Manage Cloudflare Workers, AI Gateway, edge scraping proxies, and secrets using Wrangler CLI via Bun (bunx wrangler). Use when configuring, deploying, debugging, or extending edge services for Ostrovok2026.
---

# Cloudflare Wrangler: Управление Edge-воркерами и AI Gateway

Корень репозитория находится в `../../../` относительно этого `SKILL.md`. Все команды ниже выполняются из корня репозитория, если не указано иное.

Перед внесением изменений изучи `../../../AGENTS.md` и раздел 1.3 (Отказоустойчивость и безопасность).

---

## Запуск Wrangler через Bun

Глобальная установка Wrangler в системе не требуется. Используй запуск через пакетный менеджер Bun:

```bash
bunx wrangler --version
```

### 1. Авторизация в Cloudflare

```bash
# Интерактивная авторизация через браузер
bunx wrangler login

# Проверка текущего аккаунта и прав
bunx wrangler whoami
```

В CI/CD и автоматических скриптах авторизация выполняется установкой переменной `CLOUDFLARE_API_TOKEN`.

### 2. Привязка к аккаунту без хардкода в коде

Поле `account_id` исключено из файла `wrangler.toml` ради безопасности. Wrangler считывает его автоматически из переменной окружения **`CLOUDFLARE_ACCOUNT_ID`**, инжектируемой через Doppler:

```bash
doppler run -p ostrovok2026 -c dev -- bunx wrangler whoami
```

---

## Воркер-парсер Островка (`workers/ostrovok-scraper`)

Исходный код воркера расположен в `workers/ostrovok-scraper/src/index.ts`, конфигурация — в `workers/ostrovok-scraper/wrangler.toml`.

### 1. Локальный запуск в режиме разработки

```bash
cd workers/ostrovok-scraper
bunx wrangler dev
```

Воркер поднимает локальный сервер на `http://localhost:8787` с поддержкой эмуляции Edge Runtime.

### 2. Сборка и деплой в Cloudflare Edge

```bash
cd workers/ostrovok-scraper
bunx wrangler deploy
```

После деплоя воркер получает глобальный URL вида:
`https://ostrovok-scraper.<subdomain>.workers.dev`

Этот URL прописывается в Doppler как переменная **`CLOUDFLARE_WORKER_URL`**:
```bash
doppler secrets set --project ostrovok2026 --config dev CLOUDFLARE_WORKER_URL="https://ostrovok-scraper.<subdomain>.workers.dev"
doppler secrets set --project ostrovok2026 --config prd CLOUDFLARE_WORKER_URL="https://ostrovok-scraper.<subdomain>.workers.dev"
```

### 3. Просмотр потоковых логов в реальном времени

```bash
cd workers/ostrovok-scraper
bunx wrangler tail
```

---

## Защита Cloudflare AI Gateway

Проект использует Cloudflare AI Gateway в качестве прокси для запросов к моделям Gemini (`gemini-2.5-flash`, `gemini-3.5-flash-lite`) из РФ без необходимости VPN.

Шлюз защищен функцией **Authenticated Gateways**:
- Любой запрос без авторизационного токена блокируется шлюзом с кодом `401 Unauthorized`.
- Токен `CLOUDFLARE_AI_GATEWAY_TOKEN` (`cfut_...`) хранится в Doppler.
- В коде бэкенда (`backend/app/services/llm_client.py`) заголовок автоматически инжектируется в вызовы Google GenAI SDK:

```python
from google.genai import types

headers = {"cf-aig-authorization": f"Bearer {settings.CLOUDFLARE_AI_GATEWAY_TOKEN}"}
http_opts = types.HttpOptions(base_url=settings.GEMINI_BASE_URL, headers=headers)
client = genai.Client(api_key=key, http_options=http_opts)
```

---

## Двухуровневая стратегия обхода блокировок (Fail-Safe Scraper)

1. **Уровень 1 (Edge Worker):** Воркер отправляет запросы с мобильными заголовками и парсит разметку Schema.org JSON-LD и атрибуты номеров/удобств.
2. **Уровень 2 (Google Search Grounding):** Если Островок отдает защитный экран (капчу или 403), бэкенд не падает с ошибкой, а обращается через защищенный AI Gateway к Gemini с инструментом Google Search Grounding. Это гарантирует бесперебойную работу демо даже при сетевых ограничениях.
