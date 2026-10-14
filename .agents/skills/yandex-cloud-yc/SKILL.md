---
name: yandex-cloud-yc
description: Manage Yandex Cloud resources (Managed PostgreSQL with pgvector, VPC Security Groups, Object Storage S3) via the official yc CLI. Use when provisioning, inspecting, migrating, or securing cloud infrastructure for Ostrovok2026.
---

# Yandex Cloud CLI: Управление инфраструктурой

Корень репозитория находится в `../../../` относительно этого `SKILL.md`. Все команды ниже выполняются из корня репозитория, если не указано иное.

Перед внесением инфраструктурных изменений сверяйся с конфигурацией каталога и политиками безопасности в `../../../AGENTS.md`.

---

## Конфигурация и профили CLI

На рабочей машине `yc CLI` предварительно настроен. Перед выполнением команд проверь активный профиль:

```bash
yc config list
```

Стандартные идентификаторы проекта:
- **Cloud ID**: `b1g0jnldg1g4f798hj7v`
- **Folder ID**: `b1g8ic3c05495oc68b7d`
- **Default Zone**: `ru-central1-a`

Если токен сессии истек, запуск команд `yc` может потребовать обновления авторизации через браузер (`yc init`).

---

## Managed Service for PostgreSQL + pgvector

Кластер PostgreSQL используется для хранения нормализованных данных отелей (номера, удобства, политики, отзывы) и 768-мерных векторных представлений `pgvector`.

### 1. Просмотр списка кластеров

```bash
yc managed-postgresql cluster list
```

### 2. Получение деталей и хостов кластера

```bash
yc managed-postgresql cluster get <CLUSTER_ID_OR_NAME>
yc managed-postgresql hosts list --cluster-name <CLUSTER_NAME>
```

FQDN хоста имеет формат `c-<cluster-id>.rw.mdb.yandexcloud.net`. Подключение к пулу PgBouncer осуществляется через порт **`6432`**.

### 3. Управление базами данных и пользователями

```bash
# Создание базы данных
yc managed-postgresql database create ostrovok --cluster-name <CLUSTER_NAME>

# Создание сервисного пользователя
yc managed-postgresql user create ostrovok_app \
  --cluster-name <CLUSTER_NAME> \
  --password <SECURE_PASSWORD> \
  --permissions ostrovok
```

### 4. Активация расширения pgvector

После создания базы данных подключись к ней и активируй расширение для поддержки векторных типов:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Проверка доступности расширения:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

## Формирование строки подключения DATABASE_URL

Для асинхронного драйвера `asyncpg` и SSL-режима Yandex Cloud строка подключения формируется по стандарту:

```text
postgresql+asyncpg://<USER>:<PASSWORD>@c-<CLUSTER_ID>.rw.mdb.yandexcloud.net:6432/ostrovok?sslmode=verify-full
```

Корневой сертификат Yandex Cloud скачивается командой:
```bash
# Windows PowerShell
Invoke-WebRequest -Uri "https://storage.yandexcloud.net/cloud-certs/CA.pem" -OutFile "$HOME\.postgresql\root.crt"

# Linux / macOS
mkdir -p ~/.postgresql && curl -sS https://storage.yandexcloud.net/cloud-certs/CA.pem -o ~/.postgresql/root.crt
```

Сгенерированный `DATABASE_URL` сохраняется в Doppler:
```bash
doppler secrets set --project ostrovok2026 --config dev DATABASE_URL="<URL>"
doppler secrets set --project ostrovok2026 --config prd DATABASE_URL="<URL>"
```

---

## Сетевая безопасность: Security Groups

Для изоляции базы данных порт 6432 закрывается от общего интернета:
1. Создается Security Group в VPC каталога.
2. Во входящих правилах (Ingress) разрешается порт 6432 **только** для IP-адресов серверов приложения и статических IP команды (маска `/32`).
3. При динамических IP и использовании VPN доступ на уровне приложения делегируется единому командному токену `STUDIO_TEAM_TOKEN` в слое API.

---

## Резервное копирование и Point-in-Time Recovery

Managed PostgreSQL в Yandex Cloud автоматически выполняет инкрементальные снимки и архивацию WAL-логов:

```bash
# Список доступных автоматических копий
yc managed-postgresql backup list

# Восстановление кластера из точки восстановления
yc managed-postgresql cluster restore <BACKUP_ID> --time <ISO_TIMESTAMP>
```
Дополнительно перед каждым применением изменений через Studio бэкенд сохраняет состояние в локальную таблицу `audit_hotel_snapshots`.
