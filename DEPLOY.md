# Деплой на VPS (GHCR + SSH из GitHub Actions)

Этот документ описывает, как включить автоматический деплой этого репозитория
на production-сервер. **Инфраструктура уже подготовлена в коде** — workflow,
compose-оверлей и release-пайплайн написаны и проверены. Пока VPS нет, деплой
просто тихо пропускается и ничего не ломает.

Когда появится сервер, вам останется выполнить один раз шаги ниже и добавить
6 секретов в GitHub. Больше ничего менять в коде не потребуется.

---

## Как это работает (общая схема)

```
тег v*  ──►  Release (GHCR)                     ──►  Deploy (VM over SSH)
              собирает образы                        заходит по SSH на VPS
              пушит в ghcr.io (приватно)             docker login ghcr.io
              теги: <sha7>, semver, latest           docker compose pull + up -d
                                                     секреты из Doppler prd
```

- **`release.yml`** — собирает `backend` и `frontend`, пушит приватные образы в
  GitHub Container Registry (GHCR) с тегами: короткий SHA (7 символов), semver
  (`1`, `1.2`, `1.2.3`), `latest`. Запускается на пуш тега `v*` или вручную.
- **`deploy.yml`** — после успешного `Release (GHCR)` заходит на VPS по SSH,
  логинится в GHCR, делает `docker compose pull` + `up -d` на **точный тег**
  только что собранного релиза. Секреты приложения (Gemini, S3) на GitHub
  **не передаются** — их отдаёт Doppler `prd` прямо на сервере.

Образы **приватные** (это осознанное решение). VM авторизуется в реестре
Personal Access Token'ом с правом только `read:packages`.

---

## Статус: что уже готово ✅

| Компонент | Файл | Готово |
|---|---|---|
| Сборка и публикация приватных образов в GHCR | `.github/workflows/release.yml` | ✅ |
| Автодеплой на VPS по SSH | `.github/workflows/deploy.yml` | ✅ |
| Оверлей, тянущий готовые образы вместо сборки | `docker-compose.deploy.yml` | ✅ |
| Прод-стек (Traefik, TLS, один вход, hardening) | `docker-compose.yml` | ✅ |
| Guard'ы против запуска dev-профиля в проде | `scripts/guard-dev-environment.mjs`, `backend/app/services/runtime_guard.py` | ✅ |
| CI-проверки deploy-конфигурации (19 тестов) | `scripts/test-deployment.mjs`, `scripts/test-dev-guard.mjs` | ✅ |

**Пока секретов нет, `deploy.yml` работает в режиме «спящий»**: шаг проверки
печатает предупреждение `Deploy skipped, missing repository secrets: ...` и
деплой не выполняется. CI и Release при этом работают как обычно.

---

## Что осталось сделать, когда появится VPS

Отмечайте пункты по мере выполнения.

### [ ] 1. Создать VPS

Подойдёт любой провайдер (Timeweb, Selectel, Yandex Cloud, Hetzner и т.п.).

- **ОС:** Ubuntu 22.04 / 24.04 LTS.
- **Ресурсы:** минимум 2 vCPU / 4 GB RAM (backend-образ содержит torch, а
  сборка образов идёт в GitHub, но запуску нужен запас). При наличии — 4 GB+
  для комфортной работы ChromaDB + sentence-transformers.
- **Диск:** от 40 GB (образы + `outputs/` с датасетом и ChromaDB).

### [ ] 2. Закрепить статический IP

- Привязать к серверу **постоянный (static / reserved) публичный IPv4**.
  У многих провайдеров он выдаётся по умолчанию — проверьте, что адрес не
  сменится после перезагрузки.
- **Настроить DNS:** A-запись вашего домена должна указывать на этот IP.
  Это обязательное условие — Let's Encrypt выдаёт TLS-сертификат через
  HTTP-challenge Traefik, а он требует, чтобы домен резолвился в сервер.

  ```text
  A    app.example.com    →    <статический IP>
  ```

### [ ] 3. Настроить базовый SSH-доступ

- Создать пользователя для деплоя (не работать под root, если возможно):

  ```bash
  adduser deploy
  usermod -aG sudo deploy
  usermod -aG docker deploy   # после установки Docker (шаг 5)
  ```

- Запретить вход по паролю, оставить только ключи:

  ```bash
  # /etc/ssh/sshd_config
  PasswordAuthentication no
  PermitRootLogin no
  systemctl restart ssh
  ```

- Открыть в файрволе **22, 80, 443** (80/443 нужны Traefik):

  ```bash
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw enable
  ```

### [ ] 4. Сгенерировать SSH-ключ для деплоя

Сгенерируйте **отдельную** пару ключей именно для GitHub Actions (не личный ключ):

```bash
ssh-keygen -t ed25519 -C "gha-deploy-ostrovok2026" -f ~/.ssh/ostrovok_deploy -N ""
```

- **Публичный** ключ (`ostrovok_deploy.pub`) добавьте на сервер:

  ```bash
  # на сервере, от имени deploy
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  echo "<содержимое ostrovok_deploy.pub>" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  ```

- **Приватный** ключ (`ostrovok_deploy`, содержимое целиком) понадобится для
  секрета `VM_SSH_KEY` в GitHub (шаг 8). Никому его не передавайте.

- Проверьте вход **до** добавления в GitHub:

  ```bash
  ssh -i ~/.ssh/ostrovok_deploy deploy@<IP>
  ```

### [ ] 5. Установить Docker и Doppler на сервер

```bash
# Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# Doppler CLI
# см. https://docs.doppler.com/docs/install-cli (скрипт для Debian/Ubuntu)
```

Проверка: `docker --version`, `docker compose version`, `doppler --version`.

### [ ] 6. Клонировать репозиторий на сервер

```bash
sudo mkdir -p /opt/ostrovok2026 && sudo chown deploy:deploy /opt/ostrovok2026
git clone https://github.com/Neonchik4/ostrovok2026.git /opt/ostrovok2026
cd /opt/ostrovok2026
```

> Если хотите другой путь — задайте его в секрете `VM_APP_DIR` (шаг 8).
> По умолчанию deploy-workflow использует `/opt/ostrovok2026`.

### [ ] 7. Подготовить секреты и данные на сервере

**7.1. Логин в приватный GHCR (один раз).**

Создайте classic PAT со scope **только** `read:packages`
(`GitHub → Settings → Developer settings → Tokens (classic) → Generate new token`).
Затем на сервере:

```bash
echo "<PAT_read_packages>" | docker login ghcr.io -u Neonchik4 --password-stdin
```

Проверьте, что pull реально работает:

```bash
docker pull ghcr.io/neonchik4/ostrovok2026-backend:latest
```

**7.2. Подключить Doppler `prd`.**

```bash
cd /opt/ostrovok2026
doppler login                      # или передайте service token
doppler setup                      # project: ostrovok2026, config: prd
```

Прод-секреты (Gemini key(s), S3, `ACME_EMAIL`, `APP_ENV=production`,
`HOST=0.0.0.0`, `PORT=8000`, `BACKEND_URL`) уже лежат в конфиге `prd`.
**Домен в `prd` не хранится** — задайте его на хосте явно:

```bash
doppler secrets set DOMAIN=app.example.com --config prd
# либо положите DOMAIN=app.example.com в /opt/ostrovok2026/.env на сервере
```

**7.3. Положить датасет и индексы.**

Compose монтирует `./outputs` read-only. Убедитесь, что на сервере есть:

```text
/opt/ostrovok2026/outputs/hotels.json
/opt/ostrovok2026/outputs/chroma_db_v2/
/opt/ostrovok2026/outputs/chroma_db_gemini/
/opt/ostrovok2026/letsencrypt/acme.json   # пустой файл, создайте заранее: touch
```

Датасет можно скачать скриптом (`scripts/download_dataset.py` /
`dataset_loader`) или залить с локальной машины (`rsync`/`scp`).

### [ ] 8. Добавить секреты в GitHub

`GitHub → репозиторий → Settings → Secrets and variables → Actions →
New repository secret`. Нужны **6 секретов**:

| Секрет | Обязателен | Значение |
|---|---|---|
| `VM_HOST` | да | Статический IP или DNS сервера |
| `VM_USER` | да | SSH-пользователь (напр. `deploy`) |
| `VM_SSH_KEY` | да | Приватный ключ из шага 4 (содержимое файла целиком) |
| `GHCR_READ_TOKEN` | да | Classic PAT со scope `read:packages` из шага 7.1 |
| `VM_SSH_PORT` | нет | Порт SSH, по умолчанию `22` |
| `VM_APP_DIR` | нет | Путь к репо на сервере, по умолчанию `/opt/ostrovok2026` |

> **Важно:** прод-секреты приложения (Gemini/S3) в GitHub **не добавляются**.
> Их отдаёт Doppler `prd` на сервере.

### [ ] 9. (Рекомендуется) Защитить environment `production`

Workflow использует `environment: production`. В
`Settings → Environments` можно создать этот environment и добавить
**Required reviewers**, чтобы деплой ждал подтверждения. Это не обязательно —
без environment workflow тоже работает.

### [ ] 10. Проверить деплой

Два способа:

**A. Ручной прогон workflow** (без нового релиза, развернуть конкретный тег
вида `sha-<7hex>` или semver):

```bash
gh workflow run deploy.yml --repo Neonchik4/ostrovok2026 --ref master -f image_tag=sha-3544c01
gh run watch --repo Neonchik4/ostrovok2026
```

**B. Полный цикл:** создать и запушить тег — Release соберёт образы, Deploy
сам развернёт их.

```bash
git tag v0.1.0
git push origin v0.1.0
```

После успешного деплоя проверьте на сервере:

```bash
cd /opt/ostrovok2026
docker compose -f docker-compose.yml -f docker-compose.deploy.yml ps
curl -I https://app.example.com
curl https://app.example.com/api/health
```

---

## Обновление версии в будущем

Ничего дополнительно делать не нужно. Обычный релиз:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Release соберёт приватные образы, Deploy автоматически развернёт точный SHA
на сервере.

## Откат

Развернуть предыдущий образ вручную, указав его тег (формат `sha-<7hex>` или
semver `1.2.3`):

```bash
gh workflow run deploy.yml --repo Neonchik4/ostrovok2026 -f image_tag=sha-3544c01
```

> **Про теги.** `docker/metadata-action` публикует короткий SHA **с префиксом**
> `sha-` (например `sha-3544c01`). Тег `latest` появляется только при пуше тега
> `v*`; при ручном прогоне Release его нет. Поэтому авто-деплой всегда берёт
> точный `sha-<7hex>` только что собранного релиза.

## Ручной деплой без GitHub Actions (аварийный)

Если нужно зайти на сервер и обновить стек руками:

```bash
cd /opt/ostrovok2026
export GHCR_OWNER=neonchik4 IMAGE_TAG=latest
echo "<PAT_read_packages>" | docker login ghcr.io -u Neonchik4 --password-stdin
doppler run --project ostrovok2026 --config prd -- \
  docker compose -f docker-compose.yml -f docker-compose.deploy.yml pull
doppler run --project ostrovok2026 --config prd -- \
  docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d
```

---

## Частые проблемы

| Симптом | Причина / решение |
|---|---|
| `Deploy skipped, missing repository secrets: ...` | Секреты из шага 8 ещё не добавлены. Это ожидаемо, пока нет VPS. |
| `denied: requested access to the resource is denied` при pull | `GHCR_READ_TOKEN` без scope `read.packages`, либо образ не собран (не было успешного Release). |
| `image ...: <sha> not found` | Образ с этим тегом не публиковался. Проверьте успешный прогон `Release (GHCR)` и теги (формат `sha-<7hex>`, semver, `latest` только для тегов `v*`). |
| Traefik не выдаёт сертификат | DNS A-запись не указывает на IP, либо порты 80/443 закрыты файрволом. |
| `Set ACME_EMAIL in .env` / `Set DOMAIN in .env` | Переменные не заданы ни в Doppler `prd`, ни в `.env` на хосте. |
| Backend падает с `EnvironmentMismatchError` | Контейнер запущен с `APP_ENV != production`. Он должен идти только через `docker-compose.yml`. |
| Датасет пустой (`0 отелей`) | В `outputs/hotels.json` нет обязательных полей (напр. `reviews_summary`), либо файл не смонтирован. |

---

## Безопасность (чек-лист)

- [ ] `GHCR_READ_TOKEN` — classic PAT, scope **только** `read:packages`, отдельный от личного.
- [ ] `VM_SSH_KEY` — ключ, созданный именно для деплоя, не личный.
- [ ] На сервере: `PasswordAuthentication no`, `PermitRootLogin no`.
- [ ] Файрвол открыт только на 22/80/443.
- [ ] Образы остаются **приватными** — ничего в public не переводим.
- [ ] Прод-секреты живут только в Doppler `prd` и на хосте, не в git и не в Actions.
- [ ] Датасет (`outputs/`) не коммитится и монтируется read-only.
