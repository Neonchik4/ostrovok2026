import asyncio
import time
from typing import AsyncGenerator, List, Optional
from ..config import settings

# Модели, недавно словившие 429 (rate limit), и время, когда с ними можно снова пробовать.
# Общий для call_gemini_content/stream_gemini_content процесс-локальный кэш.
_model_cooldowns: dict[str, float] = {}
_COOLDOWN_SEC = 60.0

def get_cascade_models() -> List[str]:
    """Возвращает приоритетный список моделей для каскада."""
    models = [settings.PRIMARY_MODEL]
    fallback_list = getattr(settings, "FALLBACK_MODELS", [settings.FALLBACK_MODEL])
    for m in fallback_list:
        if m not in models:
            models.append(m)
    return models

def _is_rate_limit_error(err: Exception) -> bool:
    text = str(err)
    return "429" in text or "RESOURCE_EXHAUSTED" in text.upper()

def _order_by_cooldown(models: List[str]) -> List[str]:
    """Ставит модели, ещё не восстановившиеся после 429, в конец очереди."""
    now = time.monotonic()
    available = [m for m in models if _model_cooldowns.get(m, 0.0) <= now]
    cooling_down = [m for m in models if _model_cooldowns.get(m, 0.0) > now]
    # Если все модели в кулдауне, пробуем их всё равно (лучше медленно, чем никак).
    return available + cooling_down

def _mark_rate_limited(model_name: str) -> None:
    _model_cooldowns[model_name] = time.monotonic() + _COOLDOWN_SEC

async def call_gemini_content(prompt_text: str, timeout_sec: float = 6.0) -> Optional[str]:
    """
    Secure by Design:
    - Каскадный обход моделей (PRIMARY -> FALLBACK).
    - Таймаут на каждый запрос для предотвращения зависания.
    - Отсутствие утечки ключей API и системных учетных данных в логи.
    """
    if not settings.GEMINI_API_KEY:
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        gen_config = types.GenerateContentConfig.model_validate(
            {"automatic_function_calling": {"disable": True}}
        )
        models_to_try = _order_by_cooldown(get_cascade_models())

        for idx, model_name in enumerate(models_to_try):
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=model_name,
                        contents=[{"role": "user", "parts": [{"text": prompt_text}]}],
                        config=gen_config,
                    ),
                    timeout=timeout_sec,
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                if _is_rate_limit_error(e):
                    _mark_rate_limited(model_name)
                next_target = models_to_try[idx + 1] if idx + 1 < len(models_to_try) else "fallback"
                print(f"[LLM Client] Ошибка {model_name}: {e}. Переход на {next_target}...")
    except Exception as client_err:
        print(f"[LLM Client Init Error]: {client_err}")

    return None

async def stream_gemini_content(prompt_text: str, timeout_sec: float = 5.0) -> AsyncGenerator[str, None]:
    """
    Потоковый вызов Gemini API с поддержкой каскадного переключения моделей.
    """
    if not settings.GEMINI_API_KEY:
        return

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        gen_config = types.GenerateContentConfig.model_validate(
            {"automatic_function_calling": {"disable": True}}
        )
        models_to_try = _order_by_cooldown(get_cascade_models())

        for idx, model_name in enumerate(models_to_try):
            try:
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
                    if chunk.text:
                        has_content = True
                        yield chunk.text
                        await asyncio.sleep(0.01)
                if has_content:
                    return
            except Exception as e:
                if _is_rate_limit_error(e):
                    _mark_rate_limited(model_name)
                next_target = models_to_try[idx + 1] if idx + 1 < len(models_to_try) else "fallback"
                print(f"[LLM Stream] Ошибка {model_name}: {e}. Переход на {next_target}...")
    except Exception as client_err:
        print(f"[LLM Stream Client Error]: {client_err}")
