import json
import re
from typing import Any

from pydantic import BaseModel, Field

from ..llm_client import call_gemini_content


class DOMAction(BaseModel):
    action: str = Field(description="Тип действия: set_destination, toggle_filter, set_price, scroll_to_hotel, highlight_hotel")
    selector: str = Field(default="", description="CSS селектор целевого элемента")
    value: Any = Field(default=None, description="Значение для ввода или параметр")
    label: str = Field(default="", description="Понятная подпись для пользователя")


class LiveActionResponse(BaseModel):
    persona: str = Field(default="bro", description="bro | assistant | concierge")
    speech: str = Field(description="Голосовая реплика / текст агента в выбранном ToV (БЕЗ ЭМОДЗИ)")
    steps: list[DOMAction] = Field(default_factory=list, description="Шаги манипуляции страницей")
    detected_city: str | None = None
    target_hotel_badge: str = ""


SYSTEM_PROMPT = """
Ты — интеллектуальный браузерный AI-ассистент сервиса «Островок» (стиль Meta Muse).
Твоя цель: принять запрос пользователя, выбрать подходящую персону и сгенерировать точный план действий (DOM steps) для реальной страницы поиска отелей ostrovok.ru.

ПРАВИЛО ZERO-EMOJI: Категорически запрещено использовать эмодзи и смайлики (например :) или 🔥). Только живой текст!

ПЕРСОНЫ:
1. "bro" — заботливый тревел-бро. Живой неформальный сленг ("братан", "зашибись", "огонь", "ништяк", "хоромы"). Ищет скрытую выгоду, следит за бюджетом.
2. "assistant" — деловой ассистент командировок. Сухой, точный, фокус на закрывающих документах, Wi-Fi, чеках и расположении у метро/центра.
3. "concierge" — премиум-консьерж. Наглый апселл, сразу пушит 5 звезд, президентские люксы, спа и панорамные виды ("живем один раз, берем лучшее").

ДЕЙСТВИЯ (steps):
- set_destination: selector="input[placeholder*='Куда'], [data-testid='search-input']", value="Город"
- toggle_filter: selector: селектор чекбокса ("бассейн", "спа", "пляж", "завтрак")
- set_price: value=максимальная цена в рублях
- scroll_to_hotel: selector="article, [data-testid='hotel-card']"
- highlight_hotel: value=0 (первый отель), label="Аргумент рекомендации"

Ответ верни СТРОГО в формате валидного JSON без markdown-оберток:
{
  "persona": "bro",
  "speech": "Текст ответа в выбранном стиле",
  "detected_city": "Сочи",
  "target_hotel_badge": "Теплый бассейн и скидка 15%",
  "steps": [
    {"action": "set_destination", "selector": "input[placeholder*='Куда']", "value": "Сочи", "label": "Ввод направления"},
    {"action": "toggle_filter", "selector": "input[type='checkbox']", "value": "pool", "label": "Фильтр Бассейн"},
    {"action": "scroll_to_hotel", "selector": "article", "value": 0, "label": "Фокус на лучшем отеле"},
    {"action": "highlight_hotel", "selector": "article", "value": 0, "label": "Теплый бассейн и скидка 15%"}
  ]
}
"""


class LiveActionService:
    """Сервис генерации действий агента Muse над живой страницей Островка."""

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
        
        has_pool = any(w in u for w in ["бассейн", "поплавать", "плавать"])
        has_spa = any(w in u for w in ["спа", "spa", "массаж"])
        is_luxury = any(w in u for w in ["люкс", "шикануть", "дорого", "премиум", "5 звезд"])
        
        p = persona if persona in ["bro", "assistant", "concierge"] else ("concierge" if is_luxury else "bro")

        steps: list[DOMAction] = [
            DOMAction(
                action="set_destination",
                selector="input[placeholder*='Куда'], [data-testid='search-input'], input[name='destination']",
                value=city,
                label=f"Направление: {city}",
            )
        ]
        if has_pool:
            steps.append(DOMAction(action="toggle_filter", selector="input[value*='pool'], input[name*='pool']", value="pool", label="Фильтр: Бассейн"))
        if has_spa:
            steps.append(DOMAction(action="toggle_filter", selector="input[value*='spa'], input[name*='spa']", value="spa", label="Фильтр: Спа"))

        steps.append(DOMAction(action="scroll_to_hotel", selector="article, [data-testid='hotel-card']", value=0, label="Фокус на топовом отеле"))
        steps.append(DOMAction(action="highlight_hotel", selector="article, [data-testid='hotel-card']", value=0, label="Проверено агентом"))

        if p == "assistant":
            speech = f"Параметры поездки в {city} применены. Фильтры активированы, варианты отсортированы по удобству локации и закрывающим документам."
        elif p == "concierge":
            speech = f"Выбираем лучшее в {city}. Отсек компромиссы, подсветил отель высочайшего класса с премиальным сервисом."
        else:
            speech = f"Так, {city}! Накинул нужные галочки, ценник проверил. Зацени первый вариант — просто пушка!"

        return LiveActionResponse(persona=p, speech=self._clean_emoji(speech), steps=steps, detected_city=city, target_hotel_badge="Топовый выбор")

    async def plan_action(self, user_text: str, forced_persona: str | None = None) -> LiveActionResponse:
        """Планирует действия агента над живой страницей."""
        user_prompt = f"Запрос пользователя: \"{user_text}\"\nЖелаемая персона: {forced_persona or 'автоопределение'}"
        full_prompt = f"{SYSTEM_PROMPT}\n\n{user_prompt}"

        raw_response = await call_gemini_content(full_prompt, timeout_sec=5.0)
        if not raw_response:
            return self._fallback_action(user_text, forced_persona or "bro")

        try:
            # Извлекаем JSON
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
