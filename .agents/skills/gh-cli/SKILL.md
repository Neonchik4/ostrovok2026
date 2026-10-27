---
name: gh-cli
description: Work with GitHub Issues, Pull Requests, branches, and CI checks via the gh CLI (GitHub CLI) from the terminal. Use when listing or reading issues, creating or closing issues, opening or merging pull requests, checking CI status, or automating any GitHub interaction in shell scripts. Covers bash and PowerShell (pwsh) quoting pitfalls.
---

# GitHub CLI (`gh`): работа с Issues, PR и проверками

Корень репозитория находится в `../../../` относительно этого `SKILL.md`. Все команды выполняются из корня репозитория, если не указано иное.

`gh` определяет репозиторий автоматически по `git remote origin`, поэтому флаг `-R owner/repo` нужен только при запуске вне каталога репозитория. Проверенная версия: `gh 2.100.0`; все флаги ниже сверены с `gh <command> --help`.

Перед работой прочитай `../../../AGENTS.md` и `../../rules/git-workflow.md`: в этом репозитории действует защита ветки `master` (слияние только через PR после CI), стандарт Conventional Commits без эмодзи и целевые ветки, указанные в тексте каждого issue.

---

## Золотые правила

1. **JSON-first.** Для чтения данных всегда используй `--json <fields>` вместе с `--jq '<expression>'`. Человекочитаемый вывод `gh issue view` годится только для беглого просмотра, но не для парсинга: он локализуется и меняется между версиями.
2. **Длинные тексты — только через файл или stdin.** Тело issue/PR передавай флагом `-F, --body-file` (он же `--body-file -` для stdin). Не инлайнь многострочный Markdown в аргумент `-b/--body`: экранирование кавычек и переносов ломает команду и теряет разметку.
3. **Одна команда — один смысл.** Не склеивай создание PR и слияние в одну строку: между `gh pr create` и `gh pr merge` должен пройти CI (`gh pr checks`).
4. **Проверяй результат.** После закрытия issue или мержа PR перечитай состояние через `--json state` вместо предположений.

## Авторизация и контекст

```bash
gh auth status                 # проверка токена и прав
gh repo view --json nameWithOwner --jq .nameWithOwner   # текущий репозиторий
gh auth refresh -h github.com  # перелогин при протухшем токене
```

## Issues: чтение

```bash
# Список открытых issues с метками (компактно, без лишнего текста)
gh issue list --state open --limit 100 --json number,title,labels,createdAt

# Полный текст одного issue (тело + метки + ветки)
gh issue view 44

# Только комментарии
gh issue view 44 --comments

# Машинное чтение: заголовок и тело в JSON
gh issue view 44 --json number,title,body,labels --jq '"\(.number): \(.title)"'

# Поиск по подстроке и метке
gh issue list --search "frontend" --label "area:frontend" --json number,title
```

## Issues: создание и закрытие

```bash
# Тело из временного файла (надёжный способ для Markdown)
gh issue create --title "Короткий заголовок" --body-file /tmp/issue-body.md --label "area:frontend"

# Тело из heredoc без временного файла (bash)
gh issue create --title "Короткий заголовок" --body-file - --label "area:frontend" <<'EOF'
## Контекст
Текст issue в Markdown.
EOF

# Закрыть с итоговым комментарием (ссылайся на PR)
gh issue close 44 --comment "Выполнено в PR #49: <краткий отчёт>."

# Правка: метки и исполнитель
gh issue edit 44 --add-label "priority:high" --add-assignee @me
```

## Pull Requests: создание

```bash
# Ветка уже запушена (git push -u origin <branch>)
gh pr create --title "feat(front): краткое описание" --body-file - <<'EOF'
## Что сделано
Closes #43

## Проверки
- bun run test: 136/136
EOF

# Явная базовая ветка, если отличается от default
gh pr create --base master --head feat/front-ghost-transparent-bg --title "..." --body-file body.md

# Черновик
gh pr create --draft --title "WIP: ..." --body-file body.md
```

Ключевая строка `Closes #N` в теле PR автоматически закрывает issue при мерже. Если issue закрывается вручную до мержа, оставь в комментарии ссылку на PR (`Выполнено в PR #N`).

## Pull Requests: проверка и слияние

```bash
gh pr list --author @me --json number,title,state,headRefName   # свои открытые PR
gh pr view 50 --json state,mergeable,files --jq '{state, mergeable, files: [.files[].path]}'
gh pr diff 50                                                   # полный дифф для самопроверки
gh pr checks 50                                                 # статус CI по всем job
gh pr checks 50 --watch --fail-fast                             # ждать завершения CI

# Слияние после зелёного CI (squash-коммит, удаление ветки)
gh pr merge 50 --squash --delete-branch
```

Порядок работы с PR в этом репозитории: `git push -u origin <branch>` → `gh pr create` (с `Closes #N`) → `gh pr checks <N>` до зелёного статуса → `gh pr merge --squash --delete-branch`. Прямой `git push origin master` заблокирован ruleset для всех, кроме владельца.

## Готовые рецепты

```bash
# Прочитать все открытые issues подряд (оценка объёма работ)
for i in $(gh issue list --state open --json number --jq '.[].number'); do
  echo "===== ISSUE #$i ====="; gh issue view "$i"; done

# Сверка состояния конкретных issues после работы
gh issue list --state all --json number,state,title \
  --jq '.[] | select(.number==43 or .number==44) | "\(.number) [\(.state)] \(.title)"'

# Количество открытых issues
gh issue list --state open --json number --jq length
```

## Особенности оболочек

**bash / zsh**
- `--jq '...'` пиши в одинарных кавычках: двойные провоцируют раскрытие `$` и обратных кавычек.
- Heredoc с кавыченным разделителем `<<'EOF'` отключает подстановку переменных в теле — используй его для Markdown с бэктиками.
- Внутри `--jq` экранируй внутренние кавычки как `\"` и не используй одинарные кавычки внутри выражения.

**PowerShell (pwsh)**
- Многострочный текст передавай через here-string во временный файл: `@' ... '@ | Set-Content -Encoding utf8 body.md; gh pr create --body-file body.md`. Не вставляй переносы строк прямо в аргумент `-b`.
- Продолжение строки — обратный тик `` ` `` в конце строки, а не `\` как в bash; тик должен быть последним символом строки.
- Вместо `grep`/`awk` используй `Select-String` и `ConvertFrom-Json`; вместо `cat` — `Get-Content`.
- Кодировка: при кириллице в аргументах установи `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` в начале сессии, иначе вывод и аргументы искажаются.
- Код возврата нативной команды — `$LASTEXITCODE`, а не `$?`; в скриптах проверяй `if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`.

## Границы применения

- Не используй `gh` для операций, требующих контекста Git (коммиты, мерж конфликтов) — это зона `git`.
- `gh api` доступен для произвольных REST/GraphQL-запросов, но в задачах этого репозитория хватает команд выше; прибегай к `gh api`, только если нужной команды нет.
- Токен `gh` не вставляй в код, тесты или `.env`; авторизация живёт только в локальной конфигурации `gh`.
