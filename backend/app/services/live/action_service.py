import json
import re
from typing import Any

from pydantic import BaseModel, Field

from ..llm_client import call_gemini_content


class DOMAction(BaseModel):
    action: str = Field(description="set_price | toggle_filter | set_sort | set_destination | scroll_to_hotel")
    selector: str = Field(default="", description="Селектор или идентификатор элемента")
    value: Any = Field(default=None, description="Значение для установки (число для цены, строка для направления)")
    label: str = Field(default="", description="Описание шага для логирования")


class LiveActionResponse(BaseModel):
    persona: str = Field(default="bro", description="bro | assistant | luxury")
    speech: str = Field(description="Голосовая реплика агента (БЕЗ ЭМОДЗИ, без слова 'Ищу')")
    thought: str = Field(default="", description="Ход мыслей агента для отображения в логе")
    steps: list[DOMAction] = Field(default_factory=list, description="Шаги манипуляции страницей")
    detected_city: str | None = None
    target_hotel_badge: str = ""


SYSTEM_PROMPT = """
Ты — интеллектуальный браузерный AI-агент сервиса «Островок» (Google Gemini 3.5 Flash-Lite).
Твоя цель: принять запрос пользователя, проанализировать доступные фильтры страницы и сгенерировать точный план действий (DOM steps).

ПРАВИЛО ZERO-EMOJI: Категорически запрещено использовать эмодзи и смайлики (например :) или 🔥). Только чистый текст!
ЗАПРЕТ СЛОВА "ИЩУ": Запрещено начинать реплику со слова "Ищу". Используй глаголы прямого действия: "Ставлю цену...", "Включаю фильтр...", "Выбираю отели с...".

ТИПЫ ДЕЙСТВИЙ (steps):
1. "set_price" — установка максимальной цены: value=число (например 7500).
2. "toggle_filter" — переключение чекбокса фильтра (завтрак, бассейн, питомцы, спа, пляж, район): value="название фильтра".
3. "set_sort" — сортировка выдачи: value="дешев" | "оценк" | "расстоян".
4. "set_destination" — ввод города или курорта в поисковую строку: value="Название города".

Ответ верни СТРОГО в формате валидного JSON без markdown-оберток:
{
  "persona": "bro",
  "thought": "Пользователь ищет отель с питомцами до 8000 руб в Сочи",
  "speech": "Ставлю цену до 8 000 ₽ и включаю отели, где можно с питомцами!",
  "detected_city": "Сочи",
  "target_hotel_badge": "Можно с собакой",
  "steps": [
    {"action": "set_price", "value": 8000, "label": "Лимит цены 8 000 ₽"},
    {"action": "toggle_filter", "value": "питомцы", "label": "Фильтр питомцев"}
  ]
}
"""


class LiveActionService:
    """Сервис генерации действий агента Muse на базе Google Gemini 3.5 Flash-Lite."""

    @staticmethod
    def _clean_emoji(text: str) -> str:
        """Гарантирует удаление любых случайных эмодзи и смайликов."""
        emoji_pattern = re.compile(
            r"[\U00010000-\U0010ffff\u2600-\u27bf\u2b50\u2b55\u231a-\u23f3]"
            r"|[:;]-?[\)\(\[\]\{\}\*DPOdp]"
        )
        return emoji_pattern.sub("", text).strip()

    def _fallback_action(self, user_text: str, persona: str) -> LiveActionResponse:
        """Детерминированный fallback без моков, если LLM временно недоступна."""
        u = user_text.lower()
        city = "Сочи" if ("сочи" in u or "адлер" in u) else ("Санкт-Петербург" if ("питер" in u or "петербург" in u) else "Москва")
        has_pool = any(w in u for w in ["бассейн", "поплавать"])
        has_breakfast = any(w in u for w in ["завтрак", "поесть"])
        has_station = any(w in u for w in ["вокзал", "ж/д", "жд", "станци"])
        has_airport = any(w in u for w in ["аэропорт"])
        has_24h = any(w in u for w in ["круглосуточн", "24 часа", "ночн", "стойк"])
        has_early = any(w in u for w in ["ранн", "утром"])
        is_luxury = any(w in u for w in ["люкс", "шикануть", "премиум", "5 звезд"])

        p = persona if persona in ["bro", "assistant", "luxury"] else ("luxury" if is_luxury else "bro")
        steps: list[DOMAction] = [
            DOMAction(
                action="set_destination",
                selector="input[placeholder*='Куда'], [data-testid='search-input'], input[name='destination']",
                value=city,
                label=f"Направление: {city}",
            )
        ]

        # Цена
        price_match = re.search(r"(\d[\d\s]*)\s*(?:₽|руб)?", user_text)
        if price_match:
            try:
                num = int(re.sub(r"\s+", "", price_match.group(1)))
                if num >= 100:
                    steps.append(DOMAction(action="set_price", value=num, label=f"Цена до {num} ₽"))
            except ValueError:
                pass

        if has_pool:
            steps.append(DOMAction(action="toggle_filter", value="бассейн", label="Фильтр: Бассейн"))
        if has_breakfast:
            steps.append(DOMAction(action="toggle_filter", value="завтрак", label="Фильтр: Завтрак"))
        if has_station:
            steps.append(DOMAction(action="toggle_filter", value="у вокзала", label="Фильтр: Рядом с вокзалом"))
        if has_airport:
            steps.append(DOMAction(action="toggle_filter", value="у аэропорта", label="Фильтр: Рядом с аэропортом"))
        if has_24h or has_early:
            steps.append(DOMAction(action="toggle_filter", value="круглосуточная стойка", label="Фильтр: Круглосуточная стойка 24/7"))

        speech = f"Применяю параметры поездки: {', '.join(s.label for s in steps) if steps else city}."
        return LiveActionResponse(
            persona=p,
            speech=self._clean_emoji(speech),
            thought="Локальный парсинг параметров запроса",
            steps=steps,
            detected_city=city,
            target_hotel_badge="Выбор Copilot"
        )

    async def plan_action(
        self,
        user_text: str,
        forced_persona: str | None = None,
        available_filters: list[str] | None = None,
        page_type: str | None = None,
    ) -> LiveActionResponse:
        """Планирует действия агента через Google Gemini 3.5 Flash-Lite."""
        filters_hint = f"\nДоступные фильтры на текущей странице: {', '.join(available_filters)}" if available_filters else ""
        page_hint = f"\nТип страницы: {page_type}" if page_type else ""
        user_prompt = (
            f"Запрос пользователя: \"{user_text}\"\n"
            f"Желаемая персона: {forced_persona or 'автоопределение'}"
            f"{page_hint}{filters_hint}"
        )
        full_prompt = f"{SYSTEM_PROMPT}\n\n{user_prompt}"

        raw_response = await call_gemini_content(full_prompt, timeout_sec=5.0)
        if not raw_response:
            return self._fallback_action(user_text, forced_persona or "bro")

        try:
            json_text = raw_response.strip()
            if "```" in json_text:
                json_text = re.sub(r"^```(?:json)?\s*", "", json_text)
                json_text = re.sub(r"\s*```$", "", json_text)

            data = json.loads(json_text)
            resp = LiveActionResponse.model_validate(data)
            resp.speech = self._clean_emoji(resp.speech)
            return resp
        except Exception:
            return self._fallback_action(user_text, forced_persona or "bro")
