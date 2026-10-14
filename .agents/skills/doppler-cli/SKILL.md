---
name: doppler-cli
description: Manage secrets, configurations (dev, prd), and environment injection for Ostrovok2026 using the Doppler CLI. Use when inspecting, setting, syncing, or debugging secrets and service tokens.
---

# Doppler CLI: Управление секретами проекта

Корень репозитория находится в `../../../` относительно этого `SKILL.md`. Все команды ниже выполняются из корня репозитория, если не указано иное.

Перед внесением изменений прочитай `../../../AGENTS.md` и раздел 1.3 (Zero Secret Leakage). Никогда не выводи незамаскированные значения секретов в логи агента и коммиты.

---

## Архитектура проектов и сред

Проект в Doppler зафиксирован как **`ostrovok2026`**. Основные рабочие конфигурации:

| Конфигурация | Назначение | Команда запуска приложения |
| :--- | :--- | :--- |
| **`dev`** | Локальная разработка с горячей перезагрузкой | `bun run dev:dop` |
| **`prd`** | Продакшн-среда, сборка Docker и VPS сервер | `APP_ENV=production` в контейнерах |

---

## Базовые команды управления секретами

Всегда явно указывай флаги `--project ostrovok2026` и `--config <dev|prd>`, чтобы избежать коллизий рабочего каталога.

### 1. Просмотр списка секретов (имена и маскированные значения)

```bash
doppler secrets --project ostrovok2026 --config dev
doppler secrets --project ostrovok2026 --config prd
```

### 2. Чтение конкретного значения

```bash
doppler secrets get <SECRET_NAME> --project ostrovok2026 --config dev --plain
```

### 3. Установка или обновление секретов

```bash
doppler secrets set --project ostrovok2026 --config dev KEY1="value1" KEY2="value2"
doppler secrets set --project ostrovok2026 --config prd KEY1="value1" KEY2="value2"
```

При получении временной ошибки сети (`Bad Gateway` или HTTP 502/504) повтори команду через 1-2 секунды.

### 4. Экспорт секретов в формате JSON / env

```bash
doppler secrets download --project ostrovok2026 --config dev --no-file --format=json
```

Никогда не коммить сгенерированные файлы секретов в репозиторий. Файл `.env` обязан находиться в `.gitignore`.

---

## Инжекция секретов в процессы (Runtime Injection)

Doppler передает секреты как переменные окружения напрямую в дочерний процесс, не создавая промежуточных файлов на диске:

```bash
doppler run -p ostrovok2026 -c dev -- <command>
```

В проекте настроен алиас в `package.json`:
- `bun run dev:dop` запускает фронтенд (Next.js) и бэкенд (FastAPI) с инжектированными секретами конфига `dev`.

---

## Реестр критических переменных проекта

При добавлении новых внешних сервисов синхронизируй их в обеих конфигурациях (`dev` и `prd`):

- **`GEMINI_API_KEYS`**: Пул ключей Google AI Studio через запятую.
- **`GEMINI_BASE_URL`**: URL шлюза Cloudflare AI Gateway.
- **`CLOUDFLARE_ACCOUNT_ID`**: Идентификатор пространства Cloudflare.
- **`CLOUDFLARE_AI_GATEWAY_TOKEN`**: Токен аутентификации `cfut_...` для доступа к AI Gateway.
- **`CLOUDFLARE_WORKER_URL`**: URL edge-воркера для парсинга каталога Островка.
- **`STUDIO_TEAM_TOKEN`**: Единый командный токен доступа к разделу `/studio`.
- **`DATABASE_URL`**: Строка подключения к PostgreSQL с `pgvector` в Yandex Cloud.
- **`S3_ENDPOINT_URL`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`**: Доступ к объектному хранилищу Yandex Cloud.

---

## Продакшн и CI/CD: Service Tokens

Для деплоя на сервер или запуска в CI/CD используется сервисный токен с ограниченным скоупом:

```bash
# Генерация сервисного токена для конфигурации prd
doppler configs tokens create prod-deploy-token -p ostrovok2026 -c prd --plain

# Установка токена в окружении сервера
echo 'dp.st.prd.xxxx' | doppler configure set token --scope /
```
