# INTEGRATION_PLAN.md — Подключение токенов Островка к текущему UI

> Источник токенов: `ostrovok_styles/theme.css` (313 строк) + `tokens.json`, снято с `ostrovok.ru`.
> Цель: привести текущий фронтенд (`frontend/src`) к фирменной дизайн-системе Островка
> (светлая тема, синий `#0E41D2`, шрифты PT Root UI Web / Spoof) без хардкода HEX в JSX.

---

## 1. Насколько легко адаптировать текущий UI под токены

### Вывод: адаптация **лёгкая по механике, но средняя по объёму** (оценка 7/10 «легко»).

Архитектура уже готова к сквозной замене темы, потому что построена на CSS-переменных и семантических алиасах Tailwind. Основная работа — не рефакторинг компонентов, а аккуратный маппинг палитры и зачистка точечных обходов токенов.

### Что играет в нашу пользу (делает адаптацию лёгкой)

| Фактор | Факт из кода | Эффект |
| --- | --- | --- |
| Единая точка темы | Все цвета объявлены в `src/app/globals.css` → `:root` в формате HSL | Тему можно переопределить в одном файле |
| Семантические алиасы | `tailwind.config.ts` маппит `background/foreground/card/primary/secondary/muted/accent/destructive/border/input/ring` на `hsl(var(--...))` | Компоненты не знают конкретных цветов — меняем переменные, не JSX |
| Нет хардкода HEX в JSX | `rg "\[#[0-9a-fA-F]{3,8}\]" src/` → **0 совпадений** | Правило Zero-HEX из AGENTS.md уже соблюдается, запрещённых `bg-[#...]` нет |
| Радиус через переменную | `--radius: 0.75rem` + `borderRadius.lg/md/sm` в конфиге | Скругления Островка (`4/8/12/20px`) подключаются одной строкой |
| Шрифт через переменную | `layout.tsx` отдаёт `--font-sans`, `globals.css` и `tailwind` читают `var(--font-sans)` | Замена Inter на PT Root UI Web — локальная |
| Высокая плотность токенов | `primary` используется 103 раза, `foreground` 46, `border` 50, `muted` 39, `card` 26 | Смена палитры автоматически прокатывается по всему UI |
| Шрифты уже локально | `ostrovok_styles/fonts/*.woff2` (PT Root UI Web 300/400/500/700, Spoof 500) | Не нужен внешний запрос, `next/font/local` подхватит файлы |

### Что потребует ручной работы (повышает трудоёмкость)

| Проблема | Где | Масштаб | Риск |
| --- | --- | --- | --- |
| **Смена light/dark парадигмы** | Сейчас тема тёмная (`--background: 224 45% 6%`), Островок — светлый (белый фон `#fff`, текст `#2d3137`) | Концептуальный сдвиг | Контраст текста/иконок на светлом фоне нужно перепроверить |
| **Обход токенов палитрой Tailwind** | ~25 мест с `emerald-*` / `amber-*` в 7 файлах | Точечная зачистка | Жёсткие цвета не подхватят тему → нужны токены `success`/`warning` |
| `dark` класс в разметке | `layout.tsx`: `<html className="dark ...">` | 1 строка | Останется тёмной, если не убрать/переосмыслить |
| Hover-паттерн `bg-primary/90` и т.п. | По кнопкам/карточкам | Косметика | У Островка свои hover-токены (`--p-primary-hover`), но `/90` допустимо |
| Шрифт грузится из Google | `layout.tsx`: `Inter({ subsets: [...] })` | Замена импорта | Нужен переход на `next/font/local` |

### Файлы с обходом токенов (жёсткая палитра вместо семантики)

Эти места не являются нарушением Zero-HEX (это не `#hex`), но ломают единую тему, т.к. не привязаны к CSS-переменным:

- `entities/hotel/ui/HotelCard.tsx` — `fill-amber-400 text-amber-400` (звёзды рейтинга)
- `entities/hotel/ui/HotelReceiptPreview.tsx` — `text-emerald-400` (бесплатная отмена)
- `entities/thought/ui/ThoughtStream.tsx` — `text-emerald-400` (галочка шага)
- `features/book-room/ui/BookRoomModal.tsx` — `emerald-500/*`, `text-emerald-400` (успех брони)
- `features/hotel-details/ui/HotelAspectsSummary.tsx` — `emerald-*` + `amber-*` (плюсы/минусы)
- `features/hotel-details/ui/HotelReviewsList.tsx` — `emerald-*`, `amber-400` (оценки/плюсы)
- `features/hotel-details/ui/HotelDetailModal.tsx` — `fill-amber-400 text-amber-400` (рейтинг)
- `shared/ui/badge.tsx` — вариант `success` на `emerald-500/400`

**Итог:** ядро темы меняется за один проход в `globals.css` + `tailwind.config.ts` + `layout.tsx`. Остаётся ~25 точечных правок жёсткой палитры на семантические токены `success`/`warning`/`rating` — это аккуратная, но несложная зачистка в 7 файлах.

---

## 2. Какие CSS-переменные переопределяют базовые цвета и типографику

Текущий Tailwind ждёт цвета в формате **HSL-каналов без `hsl()`** (`H S% L%`), потому что конфиг оборачивает их сам: `hsl(var(--background))`. Ниже — готовый маппинг HEX Островка → HSL для переопределения в `:root`.

### 2.1. Базовые цвета (ядро темы — переопределяются в `src/app/globals.css`)

| Переменная (текущая) | Токен Островка (`theme.css`) | HEX | Новое значение (HSL-каналы) |
| --- | --- | --- | --- |
| `--background` | `--palette-white` / `--block-bg` | `#ffffff` | `0 0% 100%` |
| `--foreground` | `--text` / `--palette-black` | `#2d3137` | `216 10% 20%` |
| `--card` | `--block-bg` | `#ffffff` | `0 0% 100%` |
| `--card-foreground` | `--text` | `#2d3137` | `216 10% 20%` |
| `--popover` | `--block-bg` | `#ffffff` | `0 0% 100%` |
| `--popover-foreground` | `--text` | `#2d3137` | `216 10% 20%` |
| `--primary` | `--palette-main` / `--p-primary` / `--button-primary-bg` | `#0E41D2` | `224 87% 44%` |
| `--primary-foreground` | `--button-primary-typo` | `#ffffff` | `0 0% 100%` |
| `--secondary` | `--palette-sec` / `--button-secondary-bg` | `#E3EBFD` | `222 87% 94%` |
| `--secondary-foreground` | `--button-secondary-typo` | `#0E41D2` | `224 87% 44%` |
| `--muted` | `--block-bg-secondary` / `--palette-ulight` | `#f4f4f4` | `0 0% 96%` |
| `--muted-foreground` | `--text-secondary` / `--palette-dark` | `#868686` | `0 0% 53%` |
| `--accent` | `--palette-sec` (светлый синий фон акцентов) | `#E3EBFD` | `222 87% 94%` |
| `--accent-foreground` | `--p-primary` | `#0E41D2` | `224 87% 44%` |
| `--destructive` | `--p-alert` / `--button-danger-bg` | `#CE2121` | `0 72% 47%` |
| `--destructive-foreground` | `--button-danger-typo` | `#ffffff` | `0 0% 100%` |
| `--border` | `--border` / `--palette-light` | `#e5e5e5` | `0 0% 90%` |
| `--input` | `--field-border` | `#e5e5e5` | `0 0% 90%` |
| `--ring` | `--focus-outline` (цветовая база) / `--p-primary` | `#0E41D2` | `224 87% 44%` |

### 2.2. Статусные цвета (новые переменные — для зачистки `emerald-*`/`amber-*`)

Нужно добавить, чтобы убрать жёсткую палитру Tailwind и завести семантику Островка:

| Новая переменная | Токен Островка | HEX | HSL-каналы |
| --- | --- | --- | --- |
| `--success` | `--p-success` | `#53AF24` | `100 66% 41%` |
| `--success-bg` | `--p-success-bg` | `#DDEFD3` | `99 47% 88%` |
| `--warning` | `--p-warning` | `#E77D00` | `32 100% 45%` |
| `--warning-bg` | `--p-warning-bg` | `#FAE5CC` | `33 82% 89%` |
| `--rating` (звёзды) | жёлтый рейтинга (сейчас `amber-400`) | `#E77D00`/жёлтый | `32 100% 45%` |

### 2.3. Радиусы (переопределяются в `globals.css` + расширяются в `tailwind.config.ts`)

Островок использует набор `--t-radius-*` (`4/6/8/12/20px`). Текущий конфиг знает только `lg/md/sm` от одного `--radius`.

| Переменная | Токен Островка | Значение |
| --- | --- | --- |
| `--radius` (база `lg`) | `--mpf-border-radius-small` / `--t-radius-md` | `12px` (`0.75rem`) — **совпадает с текущим** |
| `--radius-2xs` | `--t-radius-2xs` | `4px` |
| `--radius-sm` | `--t-radius-sm` | `8px` |
| `--radius-lg` | `--t-radius-lg` | `20px` |

> `--radius` уже равен `0.75rem = 12px`, что совпадает с `--t-radius-md` Островка, — базовый радиус менять не обязательно.

### 2.4. Типографика (переопределяется в `layout.tsx` + `globals.css`)

| Что | Сейчас | Становится (Островок) |
| --- | --- | --- |
| Body-шрифт | `Inter` (Google Fonts, `--font-sans`) | `PT Root UI Web` (локально, `--font-sans`) |
| Display-шрифт | — (нет) | `Spoof` (локально, опционально `--font-display` для заголовков) |
| Фолбэк | `system-ui, -apple-system, ...` | `Helvetica, Arial, sans-serif` (как в `theme.css` `body{}`) |
| Веса | 400/500/600/700 (variable) | 300/400/500/700 (PT Root UI) + 500 (Spoof) |
| Размеры | Tailwind по умолчанию | по желанию синхронизировать с `--t-fontsize-xs/sm/md/lg` = `12/14/16/20px` |

Ключевые размеры из `tokens.json` для сверки: `12px` / `14px` / `16px` (базовый) / `20px`.

---

## 3. Пошаговый план подключения стилей к текущему проекту

> Подход: TDD-совместимый, малыми атомарными шагами, каждый — проверяемый. Строго без хардкода HEX в JSX (меняем переменные/конфиг), без эмодзи, с сохранением FSD.

### Шаг 0. Подготовка и бэкап темы (5 мин)
1. Создать ветку: `git checkout -b feat/ostrovok-theme`.
2. Зафиксировать «до»: `git status` чистый, запустить `npm run test` (эталон 80 тестов зелёные).
3. Сохранить копию текущих токенов (закомментированным блоком `Oceanic Midnight` в `globals.css`) — чтобы можно было откатить тему без `git revert`.

### Шаг 1. Подключить локальные шрифты (15 мин)
1. Скопировать шрифты в público:
   ```bash
   mkdir -p frontend/public/fonts
   cp ostrovok_styles/fonts/*.woff2 frontend/public/fonts/
   ```
2. В `frontend/src/app/layout.tsx` заменить Google `Inter` на `next/font/local`:
   ```tsx
   import localFont from "next/font/local";

   const ptRootUi = localFont({
     variable: "--font-sans",
     display: "swap",
     src: [
       { path: "../../public/fonts/PT-Root-UI-Web-Light.974865d0.woff2",   weight: "300", style: "normal" },
       { path: "../../public/fonts/PT-Root-UI-Web-Regular.fa37ad7a.woff2", weight: "400", style: "normal" },
       { path: "../../public/fonts/PT-Root-UI-Web-Medium.4b7fa55b.woff2",  weight: "500", style: "normal" },
       { path: "../../public/fonts/PT-Root-UI-Web-Bold.853746a2.woff2",    weight: "700", style: "normal" },
     ],
   });
   ```
   и подставить `ptRootUi.variable` вместо `inter.variable` в `<html className={...}>`.
3. (Опционально) завести `Spoof` как `--font-display` для крупных заголовков витрины.
4. Проверка: `npm run dev:front`, в DevTools у `body` активен `PT Root UI Web`.

### Шаг 2. Переопределить ядро палитры в `globals.css` (20 мин)
1. В `@layer base :root` заменить значения на светлую тему Островка из раздела 2.1 (HSL-каналы).
2. Добавить статусные переменные из 2.2 (`--success`, `--success-bg`, `--warning`, `--warning-bg`, `--rating`).
3. Добавить радиусы из 2.3 (`--radius-2xs/sm/lg`); `--radius` оставить `0.75rem`.
4. Снять тёмный режим: в `layout.tsx` убрать `dark` из `className` у `<html>` (или оставить класс, но задать светлые значения вне `.dark`). Проще убрать `dark`, раз тема у Островка светлая.
5. Обновить фолбэк-стек шрифта в `globals.css` на `Helvetica, Arial, sans-serif` (как в `theme.css body{}`).
6. Проверка: фон страницы белый, текст тёмно-серый `#2d3137`, кнопки синие `#0E41D2`.

### Шаг 3. Расширить `tailwind.config.ts` семантикой статусов и радиусов (15 мин)
1. Добавить в `theme.extend.colors`:
   ```ts
   success:  { DEFAULT: "hsl(var(--success))",  foreground: "hsl(var(--background))" },
   warning:  { DEFAULT: "hsl(var(--warning))",  foreground: "hsl(var(--background))" },
   rating:   "hsl(var(--rating))",
   "success-bg": "hsl(var(--success-bg))",
   "warning-bg": "hsl(var(--warning-bg))",
   ```
2. Добавить в `borderRadius`: `"2xs": "var(--radius-2xs)"`, `sm`/`lg` синхронизировать при желании.
3. Проверка: `npm run lint` (eslint-plugin-tailwindcss не ругается на новые классы `bg-success` и т.п.).

### Шаг 4. Зачистить обход токенов (`emerald-*`/`amber-*` → семантика) (40 мин)
Пройти 7 файлов из раздела 1 и заменить жёсткую палитру на новые токены:
- `text-emerald-400` → `text-success`; `bg-emerald-500/10` → `bg-success/10`; `border-emerald-500/*` → `border-success/*`.
- `text-amber-400 fill-amber-400` (звёзды) → `text-rating fill-rating`.
- `text-amber-400` (предупреждения) → `text-warning`; `bg-amber-500/10` → `bg-warning/10`.
- В `shared/ui/badge.tsx` вариант `success` перевести на `bg-success/15 text-success border-success/30`.

Файлы: `HotelCard.tsx`, `HotelReceiptPreview.tsx`, `ThoughtStream.tsx`, `BookRoomModal.tsx`, `HotelAspectsSummary.tsx`, `HotelReviewsList.tsx`, `HotelDetailModal.tsx`, `shared/ui/badge.tsx`.

> Делать по одному файлу, после каждого — `npm run lint`. Это соблюдает Zero-HEX и возвращает статусные цвета под единую тему.

### Шаг 5. Проверить контраст на светлом фоне (20 мин)
1. Тёмная тема прощала полупрозрачности (`bg-primary/15`, `text-primary-foreground/75`) на тёмном фоне. На белом перепроверить читаемость:
   - бейджи `HotelScoreBadge` (`bg-background/90`) — теперь почти белые на белом → при необходимости усилить `border`/тень;
   - `thinking-shimmer` в `globals.css` построен на светлых `rgba(255,255,255,...)` для тёмного фона — пересобрать градиент под светлую тему (сделать базовый серый темнее, блик — светлее фона не поможет; инвертировать);
   - оверлеи модалок `bg-black/70` — оставить (работают на любой теме).
2. Проверка: вручную прогнать чат → витрину → карточку → модалку деталей → модалку брони.

### Шаг 6. Скроллбары и мелочи (10 мин)
1. В `globals.css` кастомные скроллбары используют `hsl(var(--border))` и `hsl(var(--muted-foreground)/...)` — они автоматически перейдут на светлые значения, доп. правок не нужно, но визуально проверить `.hotel-canvas-scroll`.
2. Выделение текста `selection:bg-primary/30 selection:text-primary` — на белом читаемо, оставить.

### Шаг 7. Тесты, линт, сборка (15 мин)
1. `npm run lint` — ESLint + FSD Boundaries + tailwindcss плагин без ошибок.
2. `npm run test` — все 80 тестов (41 Vitest + 39 Pytest) зелёные. При необходимости обновить снапшоты/ассершены цветов, если тесты проверяют классы.
3. `npm run build` — продакшн-сборка фронтенда проходит.
4. `git status` — убедиться, что в коммит не попали временные файлы; шрифты в `public/fonts/` добавить осознанно.

### Шаг 8. Коммит (5 мин)
- Сообщение без эмодзи, например: `feat(ui): migrate theme to Ostrovok design tokens (light, PT Root UI, blue primary)`.

---

## Резюме рисков и границ

- **Изменение парадигмы light/dark** — главный источник визуальных регрессий; закрывается Шагом 5 (ручная проверка контраста).
- **`thinking-shimmer`** — единственный эффект, завязанный на тёмный фон; требует пересборки градиента.
- **Трудоёмкость**: ядро темы (Шаги 1-3) ~50 мин; зачистка палитры (Шаг 4) ~40 мин; проверки (5-7) ~45 мин. Итого ориентировочно **2-2.5 часа** аккуратной работы.
- **Файлы не распухают**: все правки точечные, лимит 200-250 строк на файл не затрагивается.
- **Соответствие AGENTS.md**: сохраняется Zero-HEX (меняем переменные, не `#hex` в JSX), Zero-Emoji, FSD и Public API не нарушаются.
