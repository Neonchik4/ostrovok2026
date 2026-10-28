import asyncio
import time
from collections.abc import AsyncGenerator
from typing import Any

from ..config import settings
from .llm_usage import gateway_cache_hit, record_llm_call
from .offline_mode import (
    all_configured_keys_dead,
    filter_live_keys,
    is_auth_error,
    is_offline_mode,
    mark_offline,
    note_offline_once,
    register_dead_key,
)

# (ключ, модель), недавно словившие 429 (rate limit), и время, когда с ними можно снова пробовать.
# Общий для call_gemini_content/stream_gemini_content процесс-локальный кэш.
_cooldowns: dict[tuple[str, str], float] = {}
_COOLDOWN_SEC = 60.0

_clients_cache: dict[str, Any] = {}

def get_cascade_models() -> list[str]:
    """Возвращает приоритетный список моделей для каскада."""
    models = [settings.PRIMARY_MODEL]
    fallback_list = getattr(settings, "FALLBACK_MODELS", [settings.FALLBACK_MODEL])
    for m in fallback_list:
        if m not in models:
            models.append(m)
    return models

def _get_api_keys() -> list[str]:
    keys = getattr(settings, "GEMINI_API_KEYS", None) or []
    if keys:
        return keys
    return [settings.GEMINI_API_KEY] if settings.GEMINI_API_KEY else []

def _mask_key(key: str) -> str:
    return f"...{key[-4:]}" if len(key) >= 4 else "***"

def _is_rate_limit_error(err: Exception) -> bool:
    text = str(err)
    return "429" in text or "RESOURCE_EXHAUSTED" in text.upper()

def _build_attempts() -> list[tuple[str, str]]:
    """
    Строит очередь попыток (ключ, модель): сначала PRIMARY_MODEL на всех доступных
    ключах/проектах (максимально использует самую быструю/дешёвую модель на разных
    квотах), затем аналогично для каждой fallback-модели. Пары в кулдауне после 429
    уходят в конец очереди, а не выбрасываются — лучше медленно, чем никак.
    Ключи, отклоненные внешним API по авторизации, исключаются совсем (Issue #46).
    """
    keys = filter_live_keys(_get_api_keys())
    models = get_cascade_models()
    now = time.monotonic()
    available: list[tuple[str, str]] = []
    cooling_down: list[tuple[str, str]] = []
    for model_name in models:
        for key in keys:
            pair = (key, model_name)
            if _cooldowns.get(pair, 0.0) <= now:
                available.append(pair)
            else:
                cooling_down.append(pair)
    return available + cooling_down

def _mark_rate_limited(key: str, model_name: str) -> None:
    _cooldowns[(key, model_name)] = time.monotonic() + _COOLDOWN_SEC

def _get_client(key: str):
    client = _clients_cache.get(key)
    if client is None:
        from google import genai
        from google.genai import types
        http_opts = None
        base_url = getattr(settings, "GEMINI_BASE_URL", "")
        cf_token = getattr(settings, "CLOUDFLARE_AI_GATEWAY_TOKEN", "")
        headers = {}
        if cf_token:
            headers["cf-aig-authorization"] = f"Bearer {cf_token}"
        if base_url:
            http_opts = types.HttpOptions(base_url=base_url, headers=headers if headers else None)
        elif headers:
            http_opts = types.HttpOptions(headers=headers)
        client = genai.Client(api_key=key, http_options=http_opts)
        _clients_cache[key] = client
    return client

get_gemini_client = _get_client


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


async def call_gemini_content(
    prompt_text: str, timeout_sec: float = 6.0, stage: str = "llm"
) -> str | None:
    """
    Secure by Design:
    - Каскадный обход (ключ проекта AI Studio x модель): PRIMARY -> FALLBACK, на каждом ключе.
    - Таймаут на каждый запрос для предотвращения зависания.
    - Отсутствие утечки ключей API и системных учетных данных в логи (ключи маскируются).
    - Zero-Config Offline Mode: без ключей или после авторизационного отказа всех ключей
      возвращает None мгновенно, без единого сетевого вызова (Issue #46).
    """
    if is_offline_mode():
        note_offline_once()
        return None

    attempts = _build_attempts()
    if not attempts:
        return None

    try:
        from google.genai import types

        gen_config = types.GenerateContentConfig.model_validate(
            {"automatic_function_calling": {"disable": True}}
        )

        for idx, (key, model_name) in enumerate(attempts):
            try:
                client = _get_client(key)
                started = time.monotonic()
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=model_name,
                        contents=[{"role": "user", "parts": [{"text": prompt_text}]}],
                        config=gen_config,
                    ),
                    timeout=timeout_sec,
                )
                # Ответ получен — запрос оплачен, даже если текст пустой
                record_llm_call(
                    stage=stage,
                    model=getattr(response, "model_version", None) or model_name,
                    usage=getattr(response, "usage_metadata", None),
                    duration_ms=_elapsed_ms(started),
                    gateway_cache_hit=gateway_cache_hit(response),
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                if _is_rate_limit_error(e):
                    _mark_rate_limited(key, model_name)
                if is_auth_error(str(e)):
                    register_dead_key(key)
                next_target = attempts[idx + 1] if idx + 1 < len(attempts) else None
                next_desc = f"{next_target[1]} ({_mask_key(next_target[0])})" if next_target else "fallback"
                print(f"[LLM Client] Ошибка {model_name} ({_mask_key(key)}): {e}. Переход на {next_desc}...")
    except Exception as client_err:
        print(f"[LLM Client Init Error]: {client_err}")

    if all_configured_keys_dead():
        mark_offline("все GEMINI_API_KEYS отклонены внешним API (auth error)")

    return None

async def stream_gemini_content(
    prompt_text: str, timeout_sec: float = 5.0, stage: str = "llm"
) -> AsyncGenerator[str, None]:
    """
    Потоковый вызов Gemini API с поддержкой каскадного переключения (ключ x модель).
    Zero-Config Offline Mode: без валидных ключей не выполняет ни одного сетевого вызова.
    """
    if is_offline_mode():
        note_offline_once()
        return

    attempts = _build_attempts()
    if not attempts:
        return

    try:
        from google.genai import types

        gen_config = types.GenerateContentConfig.model_validate(
            {"automatic_function_calling": {"disable": True}}
        )

        for idx, (key, model_name) in enumerate(attempts):
            # usage_metadata приходит в последнем чанке; модель — фактическая из ответа
            started = time.monotonic()
            ttft_ms: int | None = None
            usage: Any = None
            answered_by = model_name
            cache_hit = False
            try:
                client = _get_client(key)
                stream = await asyncio.wait_for(
                    client.aio.models.generate_content_stream(
                        model=model_name,
                        contents=[{"role": "user", "parts": [{"text": prompt_text}]}],
                        config=gen_config,
                    ),
                    timeout=timeout_sec,
                )
                has_content = False
                async for chunk in stream:
                    usage = getattr(chunk, "usage_metadata", None) or usage
                    answered_by = getattr(chunk, "model_version", None) or answered_by
                    cache_hit = cache_hit or gateway_cache_hit(chunk)
                    if chunk.text:
                        if ttft_ms is None:
                            ttft_ms = _elapsed_ms(started)
                        has_content = True
                        yield chunk.text
                        await asyncio.sleep(0.01)
                record_llm_call(
                    stage=stage,
                    model=answered_by,
                    usage=usage,
                    duration_ms=_elapsed_ms(started),
                    ttft_ms=ttft_ms,
                    gateway_cache_hit=cache_hit,
                )
                if has_content:
                    return
            except Exception as e:
                # Стрим оборвался после начала ответа — он оплачен, даже если usage не дошёл
                if usage is not None or ttft_ms is not None:
                    record_llm_call(
                        stage=stage,
                        model=answered_by,
                        usage=usage,
                        duration_ms=_elapsed_ms(started),
                        ttft_ms=ttft_ms,
                        gateway_cache_hit=cache_hit,
                    )
                if _is_rate_limit_error(e):
                    _mark_rate_limited(key, model_name)
                if is_auth_error(str(e)):
                    register_dead_key(key)
                next_target = attempts[idx + 1] if idx + 1 < len(attempts) else None
                next_desc = f"{next_target[1]} ({_mask_key(next_target[0])})" if next_target else "fallback"
                print(f"[LLM Stream] Ошибка {model_name} ({_mask_key(key)}): {e}. Переход на {next_desc}...")
    except Exception as client_err:
        print(f"[LLM Stream Client Error]: {client_err}")

    if all_configured_keys_dead():
        mark_offline("все GEMINI_API_KEYS отклонены внешним API (auth error)")
