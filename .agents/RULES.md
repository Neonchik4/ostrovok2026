# Свод правил и инженерных стандартов для AI-агентов (.agents/RULES.md)

Главный источник архитектурных стандартов проекта: [AGENTS.md](file:///c:/Users/vanya/OneDrive/Desktop/ostrovok2026/AGENTS.md).
Данный документ и специализированные модули в каталоге `.agents/rules/` определяют обязательные правила для любых автономных AI-агентов и разработчиков.

---

## 1. Структура специализированных правил

Для предотвращения смешивания контекста правила разделены по направлениям:

1. [Фронтенд (.agents/rules/frontend.md)](file:///c:/Users/vanya/OneDrive/Desktop/ostrovok2026/.agents/rules/frontend.md)
   * Zero-Emoji Policy (полный запрет смайликов и эмодзи в UI, коде и чате).
   * Feature-Sliced Design (FSD), Public API `index.ts`, запрет кросс-импортов.
   * Dark Swiss Minimalist (запрет HEX, семантические токены Tailwind).
   * Потоковый клиент `useChatStream`, `sseReader` и автоскролл.

2. [Бэкенд (.agents/rules/backend.md)](file:///c:/Users/vanya/OneDrive/Desktop/ostrovok2026/.agents/rules/backend.md)
   * Строгий детерминизм бизнес-логики (Zero AI-Slop, расчет чека кодом в `receipt_calc.py`).
   * Модульная SRP-архитектура сервисов (`llm_client`, `slot_extractor`, `vector_store`, `hotel_filters`).
   * Каскад моделей (PRIMARY -> FALLBACK) и таймауты до 5-6 секунд.
   * Динамические реестры локаций на базе `backend/app/data/locations.json`.

3. [Безопасность и тестирование (.agents/rules/security-and-testing.md)](file:///c:/Users/vanya/OneDrive/Desktop/ostrovok2026/.agents/rules/security-and-testing.md)
   * Zero Mocks Policy (99% реальные данные в рантайме, моки разрешены только в `tests/`).
   * Secure by Design & TDD (тесты пишутся ДО написания рабочего кода).
   * Санитизация ввода (`sanitize_user_input`), защита от ReDoS, клампинг диапазонов.
   * Zero Secret Leakage (сокрытие ключей и системных промптов).

4. [Контроль Git и чистота репозитория (.agents/rules/git-workflow.md)](file:///c:/Users/vanya/OneDrive/Desktop/ostrovok2026/.agents/rules/git-workflow.md)
   * Проверка чистоты `git status` перед коммитом.
   * Своевременное пополнение `.gitignore` (кэши, дампы, динамические индексные файлы).
   * Формат Conventional Commits без эмодзи.
   * Обязательный чек-лист: `bun run lint` (0 ошибок), `bun run test` (100% pass).

5. [Bun/uv workflow skill](skills/bun-uv-workflow/SKILL.md)
   * Bun управляет JavaScript-зависимостями и командами; Next.js и Vitest остаются на Node.js.
   * uv управляет корневой `.venv` и Python 3.11 по `pyproject.toml` и `uv.lock`.
   * Только frozen/locked установки; обновления библиотек и индексов не совмещаются с настройкой инструментов.

---

## 2. Связка с корневым AGENTS.md
Корневой файл [AGENTS.md](file:///c:/Users/vanya/OneDrive/Desktop/ostrovok2026/AGENTS.md) является стратегическим манифестом команды «О!Хакатон 2026».
Каталог `.agents/` является операционным расширением манифеста для ежедневной инженерной работы. В случае любого конфликта приоритет отдается принципам надежности, детерминизма и безопасности.
