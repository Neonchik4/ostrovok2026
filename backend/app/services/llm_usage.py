"""
Телеметрия стоимости запросов к LLM (окно Request Cost).

Каждый успешный ответ Gemini API (генерация, стрим, эмбеддинг) фиксируется как
LlmCallUsage: фактическая модель, токены из usage_metadata, TTFT, скорость и
стоимость по официальному прайсу из data/llm_pricing.json. Сбор идёт в рамках
одного SSE-запроса через ContextVar; workflow выгружает накопленное событием llm_usage.
"""

import json
from contextvars import ContextVar, Token
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import BaseModel

_PRICING_PATH = Path(__file__).resolve().parent.parent / "data" / "llm_pricing.json"


class LlmCallUsage(BaseModel):
    """Один оплачиваемый вызов LLM API."""

    stage: str
    model: str
    # Токены из usage_metadata; None — API их не вернул (показываем «не удалось получить»)
    input_tokens: int | None
    cached_tokens: int | None
    # Выходные токены, включая токены размышлений (так их тарифицирует Google)
    output_tokens: int | None
    thinking_tokens: int | None
    total_tokens: int | None
    # Время до первого токена; None для вызовов без стриминга
    ttft_ms: int | None
    duration_ms: int
    # Видимые токены ответа в секунду; для стрима — без учёта TTFT
    output_tokens_per_sec: float | None
    streamed: bool
    # Ответ отдал кэш Cloudflare AI Gateway — до Google запрос не дошёл и не оплачивается
    gateway_cache_hit: bool
    # None — нет токенов или модели нет в прайсе (цену не угадываем)
    cost_usd: float | None


_collected: ContextVar[list[LlmCallUsage] | None] = ContextVar("llm_usage_collected", default=None)


@lru_cache(maxsize=1)
def load_pricing() -> dict[str, Any]:
    """Прайс из data/llm_pricing.json; не прочитался — пустой (стоимость будет «не удалось получить»)."""
    try:
        with _PRICING_PATH.open(encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _model_prices(model: str) -> dict[str, float] | None:
    """Цены только для модели, которая точно есть в прайсе Google — похожие имена не угадываем."""
    models: dict[str, dict[str, float]] = load_pricing().get("models", {})
    return models.get(model)


def cost_usd(model: str, *, input_tokens: int, cached_tokens: int, output_tokens: int) -> float | None:
    prices = _model_prices(model)
    if prices is None:
        return None
    # Нужной цены в прайсе нет (например, кэш у эмбеддингов) — не считаем, а не подставляем
    parts = [
        (max(0, input_tokens - cached_tokens), "input"),
        (cached_tokens, "cached_input"),
        (output_tokens, "output"),
    ]
    if any(tokens and kind not in prices for tokens, kind in parts):
        return None
    return sum(tokens * prices.get(kind, 0.0) for tokens, kind in parts) / 1_000_000


def start_llm_usage_collection() -> Token:
    return _collected.set([])


def stop_llm_usage_collection(token: Token) -> None:
    _collected.reset(token)


def drain_llm_usage() -> list[LlmCallUsage]:
    """Забирает вызовы, накопленные с прошлой выгрузки."""
    calls = _collected.get()
    if not calls:
        return []
    drained = list(calls)
    calls.clear()
    return drained


def gateway_cache_hit(response: Any) -> bool:
    """Заголовок cf-aig-cache-status: HIT у ответа, прошедшего через Cloudflare AI Gateway."""
    http = getattr(response, "sdk_http_response", None)
    headers = getattr(http, "headers", None) or {}
    return any(
        name.lower() == "cf-aig-cache-status" and str(value).upper() == "HIT"
        for name, value in headers.items()
    )


def _count(value: Any) -> int:
    return int(value) if isinstance(value, int | float) else 0


def record_llm_call(
    *,
    stage: str,
    model: str,
    usage: Any,
    duration_ms: int,
    ttft_ms: int | None = None,
    gateway_cache_hit: bool = False,
) -> None:
    """
    Фиксирует вызов по usage_metadata ответа Gemini. Вне сбора — no-op.
    Ответ без usage_metadata тоже фиксируется: он оплачен, но токены и цена неизвестны.
    """
    calls = _collected.get()
    if calls is None:
        return
    if usage is None:
        calls.append(
            LlmCallUsage(
                stage=stage,
                model=model,
                input_tokens=None,
                cached_tokens=None,
                output_tokens=None,
                thinking_tokens=None,
                total_tokens=None,
                ttft_ms=ttft_ms,
                duration_ms=duration_ms,
                output_tokens_per_sec=None,
                streamed=ttft_ms is not None,
                gateway_cache_hit=gateway_cache_hit,
                cost_usd=0.0 if gateway_cache_hit else None,
            )
        )
        return

    input_tokens = _count(getattr(usage, "prompt_token_count", 0))
    cached_tokens = _count(getattr(usage, "cached_content_token_count", 0))
    answer_tokens = _count(getattr(usage, "candidates_token_count", 0))
    thinking_tokens = _count(getattr(usage, "thoughts_token_count", 0))
    output_tokens = answer_tokens + thinking_tokens
    total_tokens = _count(getattr(usage, "total_token_count", 0)) or input_tokens + output_tokens

    generation_ms = duration_ms - ttft_ms if ttft_ms is not None else duration_ms
    speed = answer_tokens / (generation_ms / 1000) if answer_tokens and generation_ms > 0 else None

    calls.append(
        LlmCallUsage(
            stage=stage,
            model=model,
            input_tokens=input_tokens,
            cached_tokens=cached_tokens,
            output_tokens=output_tokens,
            thinking_tokens=thinking_tokens,
            total_tokens=total_tokens,
            ttft_ms=ttft_ms,
            duration_ms=duration_ms,
            output_tokens_per_sec=round(speed, 1) if speed is not None else None,
            streamed=ttft_ms is not None,
            gateway_cache_hit=gateway_cache_hit,
            cost_usd=0.0
            if gateway_cache_hit
            else cost_usd(
                model,
                input_tokens=input_tokens,
                cached_tokens=cached_tokens,
                output_tokens=output_tokens,
            ),
        )
    )
