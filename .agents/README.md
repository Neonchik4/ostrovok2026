# Директория инструкций и правил AI-агентов (.agents/)

Связано с главным архитектурным манифестом проекта: [AGENTS.md](file:///c:/Users/vanya/OneDrive/Desktop/ostrovok2026/AGENTS.md).

Данный каталог содержит специализированные модульные руководства для AI-ассистентов, соблюдающие принцип Single Responsibility Principle (SRP) для контекста модели.

## Структура каталога:
* **`RULES.md`** — сводный индекс правил и связь с корневым `AGENTS.md`.
* **`rules/frontend.md`** — правила фронтенда: FSD, Public API, Dark Swiss Minimalist, запрет HEX и Zero-Emoji.
* **`rules/backend.md`** — правила бэкенда: детерминизм, калькулятор чека, SRP-сервисы, каскад моделей, динамические локации.
* **`rules/security-and-testing.md`** — правила безопасности: запрет моков в рантайме, Secure by Design, TDD, санитизация и клампинг.
* **`rules/git-workflow.md`** — регламент Git: `.gitignore`, Conventional Commits, проверка `git status`, верификационный пайплайн.
* **[`skills/bun-uv-workflow/SKILL.md`](skills/bun-uv-workflow/SKILL.md)** — skill для установки, запуска и проверки проекта через Bun и uv; правила работы с lock-файлами и сохранения Node.js/Python runtime.
