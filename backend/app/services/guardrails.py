"""
Детерминированный слой Guardrails (Issue #45).

Secure by Design: каверзные запросы (промпт-инъекции, попытки извлечь системный
промпт или секреты, симуляция смены роли) и несвязанный оффтоп не доходят до LLM.
Агент возвращает вежливый детерминированный ответ и возвращает диалог к теме
планирования путешествий.

Два уровня классификации:
- injection: явные векторы атаки — блокируются всегда, приоритетнее всего;
- offtopic: запрос без туристического контекста — вежливый возврат к теме.

Приветствия, благодарности и короткие уточнения не считаются оффтопом.
"""

import re
from typing import Literal

GUARDRAIL_OFFTOPIC_RESPONSE = (
    "Я ваш туристический консьерж Островка и с радостью помогу спланировать поездку, "
    "выбрать отель или рассчитать маршрут. Куда бы вы хотели отправиться?"
)

GUARDRAIL_INJECTION_RESPONSE = (
    "Этот запрос нарушает правила использования сервиса, поэтому я не могу его выполнить. "
    "Я помогу подобрать отель, рассчитать стоимость поездки и составить маршрут. "
    "Куда бы вы хотели отправиться?"
)

GUARDRAIL_THOUGHT_INJECTION = (
    "Сработал фильтр безопасности: обнаружена попытка промпт-инъекции. Запрос заблокирован."
)
GUARDRAIL_THOUGHT_OFFTOPIC = (
    "Запрос вне контекста туристического сервиса. Возвращаю диалог к планированию поездки."
)

RequestVerdict = Literal["travel", "offtopic", "injection"]

# Векторы промпт-инъекций и попыток утечки (Issue #45: Jailbreak, System Prompt
# Extraction, DAN, Role Reversal, Secret Leakage). Детерминированные regex-паттерны.
INJECTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    # "Ignore previous instructions..." и переводы
    re.compile(r"ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?)", re.IGNORECASE),
    re.compile(r"disregard\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier)", re.IGNORECASE),
    re.compile(r"(?:забудь|забудьте|игнорируй)\s+(?:все\s+)?(?:свои\s+)?(?:предыдущие\s+|прежние\s+)?(?:инструкции|указания|правила|промпт\w*)", re.IGNORECASE),
    # Извлечение системного промпта
    re.compile(r"system\s+prompt", re.IGNORECASE),
    re.compile(r"(?:выведи|покажи|покажите|распечатай|напечатай|верни)\s+(?:мне\s+)?(?:свой|свои|твой|твои)?\s*(?:системн\w*\s+)?(?:промпт|инструкци\w+|настройки)", re.IGNORECASE),
    re.compile(r"(?:reveal|print|output|show|repeat)\s+(?:your\s+|the\s+)?(?:system|initial|hidden|original)\s+(?:prompt|instructions?|message)", re.IGNORECASE),
    # Запрос секретов и переменных окружения
    re.compile(r"(?:покажи|покажите|выведи|раскрой|напиши)\s+(?:мне\s+)?(?:свои\s+|все\s+)?(?:api[\s_-]?key\w*|ключи?|секреты?|токены?|переменные\s+окружения|env\b)", re.IGNORECASE),
    re.compile(r"(?:show|reveal|print|output|give\s+me)\s+(?:me\s+)?(?:your\s+|the\s+)?(?:api[\s_-]?key\w*|secrets?|tokens?|env(?:ironment)?\s+variables?|\.env)", re.IGNORECASE),
    # Смена роли / джейлбрейк (DAN, "ты теперь злой хакер")
    re.compile(r"\bDAN\s+mode\b|do\s+anything\s+now", re.IGNORECASE),
    re.compile(r"jailbreak|джейлбрейк", re.IGNORECASE),
    re.compile(r"ты\s+теперь\s+(?:злой|свободный|без\s+ограничений|взломан)", re.IGNORECASE),
    re.compile(r"(?:ты|вы)\s+(?:больше\s+)?не\s+(?:связаны|ограничены)\s+(?:правилами|ограничениями|инструкциями)", re.IGNORECASE),
    re.compile(r"(?:претворись|представь|притворись|сыграй|изобрази)\s+,\s*что\s+ты\s+(?:злой|свободный|хакер)", re.IGNORECASE),
    re.compile(r"(?:pretend|act)\s+to\s+be\s+(?:an?\s+)?(?:evil|unrestricted|uncensored|hacker)", re.IGNORECASE),
    re.compile(r"(?:выйди|выйти)\s+из\s+роли", re.IGNORECASE),
)

# Маркеры туристического контекста: запрос считается travel, если содержит любой из них.
TRAVEL_KEYWORDS_PATTERN = re.compile(
    r"отел\w*|гостиниц\w*|апартамент\w*|хостел\w*|жиль\w*|номер\w*|поездк\w*|путешеств\w*|поех\w*|поед\w*|съезд\w*|езд\w*|"
    r"отзыв\w*|рейтинг\w*|"
    r"маршрут\w*|билет\w*|поезд\w*|самолет\w*|рейс\w*|авиа|ж/?д|вокзал\w*|аэропорт\w*|"
    r"вылет\w*|прилет\w*|прибыт\w*|трансфер\w*|заселен\w*|заезд\w*|выезд\w*|чекин|checkin|checkout|"
    r"город\w*|курорт\w*|мор\w*|гор\w*|пляж\w*|бассейн\w*|спа|саун\w*|завтрак\w*|отмен\w*|звезд\w*|подъемник\w*|"
    r"столиц\w*|куд\w*|брон\w*|ноч\w*|дат\w*|выходн\w*|выхи\b|отпуск\w*|отдых\w*|экскурс\w*|"
    r"бюджет\w*|цена\w*|стоимост\w*|рубл\w*|гост\w*|семь\w*|с\s+питомцем|собак\w*|кошк\w*|хорьк\w*|хорек\w*|"
    r"тепл\w*|северн\w*\s+сияни\w*|пару\s+дней|дн[ея]|сут\w*|инвалид\w*|коляск\w*|"
    r"сочи\w*|анап\w*|геленджик\w*|казан\w*|питер\w*|петербург\w*|спб\b|москв\w*|мск\b|калининград\w*|кениг\w*|"
    r"екатеринбург\w*|екб\b|красн\w*\s+полян\w*|шерегеш\w*|геш\w*|алтай\w*|байкал\w*|карели\w*|мурманск\w*|дагестан\w*|"
    r"ярославл\w*|нижн\w*|владивосток\w*|самар\w*|уф\w*|перм\w*|тюмен\w*|челябинск\w*|красноярск\w*|новосибирск\w*|ростов\w*",
    re.IGNORECASE,
)

# Светские реплики: не оффтоп, обрабатываются обычным пайплайном.
PLEASANTRY_PATTERN = re.compile(
    r"^\s*(?:привет|здравствуй\w*|добрый\s+(?:день|вечер|утро)|доброе\s+утро|"
    r"спасибо|благодар\w*|ок|окей|хорошо|отлично|супер|да|нет|"
    r"hello|hi\b|thanks|thank\s+you|bye)\b",
    re.IGNORECASE,
)

# Утечка секретов в исходящем тексте (Zero Secret Leakage).
# Порядок важен: присваивания вида VAR=value проверяются первыми и поглощают значение,
# чтобы сырые паттерны значений не порождали двойную замену поверх плейсхолдера.
_SECRET_LEAK_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:GEMINI_API_KEY\w*|API_KEY\w*|SECRET\w*|TOKEN\w*|PASSWORD\w*)\s*[=:]\s*\S+", re.IGNORECASE),
    re.compile(r"AIza[A-Za-z0-9_-]{20,}"),
    re.compile(r"AQ\.Ab8[A-Za-z0-9_-]{20,}"),
    re.compile(r"sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"cfut_[a-zA-Z0-9_-]{30,}"),
    re.compile(r"dp\.(?:st|pt)\.[a-zA-Z0-9._-]{30,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
)

_REDACTED_PLACEHOLDER = "[заблокировано системой безопасности]"


# Короткие ответы на уточняющие вопросы агента: чистые числа, время, диапазоны.
_SHORT_ANSWER_PATTERN = re.compile(r"^\s*[\d\s:.,+\-*/()]+$")


def classify_request(user_message: str) -> RequestVerdict:
    """
    Детерминированная классификация запроса до передачи в LLM-каскад.
    Инъекции блокируются всегда; оффтоп без туристического контекста —
    вежливо возвращается к теме путешествий. Короткие сообщения проходят
    дальше только как тревел-маркеры, светские реплики или чистые ответы
    (числа, время) на уточняющие вопросы агента.
    """
    text = (user_message or "").strip()
    if not text:
        return "travel"

    for pattern in INJECTION_PATTERNS:
        if pattern.search(text):
            return "injection"

    if TRAVEL_KEYWORDS_PATTERN.search(text):
        return "travel"

    if PLEASANTRY_PATTERN.match(text):
        return "travel"

    # Короткие ответы на уточняющие вопросы агента (числа, время, диапазоны)
    if len(text) <= 40:
        return "travel" if _SHORT_ANSWER_PATTERN.match(text) else "offtopic"

    return "offtopic"


def sanitize_outgoing(text: str) -> str:
    """
    Zero Secret Leakage: блокирует упоминания секретов и служебных конструкций
    в исходящих SSE-событиях (token, thought, error). Применяется к каждому чанку.
    """
    if not text:
        return text
    sanitized = text
    for pattern in _SECRET_LEAK_PATTERNS:
        sanitized = pattern.sub(_REDACTED_PLACEHOLDER, sanitized)
    return sanitized


__all__ = [
    "GUARDRAIL_INJECTION_RESPONSE",
    "GUARDRAIL_OFFTOPIC_RESPONSE",
    "GUARDRAIL_THOUGHT_INJECTION",
    "GUARDRAIL_THOUGHT_OFFTOPIC",
    "classify_request",
    "sanitize_outgoing",
]
