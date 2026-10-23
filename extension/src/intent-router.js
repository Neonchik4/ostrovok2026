/**
 * Intent Router & Wild Query Resolver
 * Dispatches arbitrary user queries (prices, distance, sorting, filters, destinations)
 * with hybrid local execution and Google Gemini (Flash-Lite) fallback.
 */
import { requestActionPlan } from "./network.js";
import { applyPriceRange, cleanQuery, parsePriceRangeIntent, setDistanceLimit, setPriceLimit, setSortOption } from "./semantic-dom.js";
import { speakAloud } from "./voice.js";

export function extractTargetEntity(rawText) {
  return cleanQuery(rawText);
}

export async function routeUserIntent(rawQuery, actor, thoughtLog, pageContext) {
  const query = (rawQuery || "").trim();
  if (!query) return;

  thoughtLog.clear();
  thoughtLog.addStep("intent", `Распознан запрос: "${query}"`);

  // 1. Capability question: "Что ты умеешь?"
  if (/что ты умеешь|что умеешь|помощь|help|кто ты/i.test(query)) {
    thoughtLog.addStep("dom", "Запрос возможностей агента");
    const reply = "Я нахожу любые районы, отели и достопримечательности, кручу слайдеры цен и довожу бронь до покупки.";
    actor.speak(reply, 5000);
    speakAloud(reply);
    thoughtLog.addStep("success", "Озвучен голосовой ответ возможностей");
    return;
  }

  // 2. Real Ostrovok Booking Intent: "Забронируй", "Купи"
  if (/забронир|купи|оформ/i.test(query)) {
    thoughtLog.addStep("dom", "Поиск целевого тарифа и кнопки бронирования на Островке...");
    const ok = await actor.bookRoomOnOstrovok(pageContext.data?.recommendedRoom);
    if (ok) {
      thoughtLog.addStep("success", "Переход к реальному оформлению заказа на Островке");
    } else {
      thoughtLog.addStep("error", "Кнопка бронирования отсутствует на текущем экране");
      actor.speak("Кнопка бронирования не найдена на этой странице.");
    }
    return;
  }

  // 3. Price Filter Intent (Both Min and Max support!)
  const priceRange = parsePriceRangeIntent(query);
  if (priceRange && (priceRange.minPrice || priceRange.maxPrice)) {
    const minStr = priceRange.minPrice ? `от ${priceRange.minPrice} ₽` : "";
    const maxStr = priceRange.maxPrice ? `до ${priceRange.maxPrice} ₽` : "";
    const desc = [minStr, maxStr].filter(Boolean).join(" ");

    thoughtLog.addStep("dom", `Распознан диапазон цен: ${desc}`);
    const onStep = (tag, msg) => thoughtLog.addStep(tag, msg);
    const ok = applyPriceRange(priceRange.minPrice, priceRange.maxPrice, document, onStep);
    if (ok) {
      thoughtLog.addStep("success", `Цены успешно зафиксированы: ${desc}`);
      actor.speak(`Установил цену: ${desc}!`);
      const targetInput = document.querySelector(priceRange.maxPrice ? '#price_to' : '#price_from');
      if (targetInput) actor.flyToElement(targetInput);
      return;
    }
  }

  // 4. Distance Filter Intent
  const distMatch = query.match(/(?:до|ближе чем)\s*(\d+)\s*км/i);
  if (distMatch) {
    const km = parseInt(distMatch[1], 10);
    thoughtLog.addStep("dom", `Обнаружен фильтр расстояния: до ${km} км`);
    const onStep = (tag, msg) => thoughtLog.addStep(tag, msg);
    const ok = setDistanceLimit(km, document, onStep);
    if (ok) {
      thoughtLog.addStep("success", `Фильтр расстояния установлен на ${km} км`);
      actor.speak(`Расстояние до ${km} км установлено!`);
      const distEl = document.querySelector('#distance_filter\\.field');
      if (distEl) actor.flyToElement(distEl);
      return;
    }
  }

  // 5. Sorting Intent
  if (/сначала дешев|подешев|по оценк|по рейтинг|по расстоян/i.test(query)) {
    const hint = /дешев/i.test(query) ? "дешев" : /оценк|рейтинг/i.test(query) ? "оценк" : "расстоян";
    thoughtLog.addStep("dom", `Настройка сортировки выдачи: ${hint}`);
    const ok = setSortOption(hint, document);
    if (ok) {
      thoughtLog.addStep("success", "Сортировка выдачи успешно изменена");
      actor.speak(`Сортировка по ${hint === "дешев" ? "цене" : hint === "оценк" ? "рейтингу" : "расстоянию"} применена!`);
      return;
    }
  }

  // 6. Arbitrary Filter, Neighborhood or Attraction (Fast Local Reflex)
  const target = extractTargetEntity(query);
  const desiredState = !/выключ|сними|убери|отключ/i.test(query);

  thoughtLog.addStep("scan", `Поиск фильтра: «${target}» (целевое состояние: ${desiredState ? "ВКЛ" : "ВЫКЛ"})...`);

  const onStep = (tag, msg) => thoughtLog.addStep(tag, msg);
  const filterMatched = await actor.toggleSemanticFilter(target, desiredState, onStep);
  if (filterMatched) {
    thoughtLog.addStep("success", `Фильтр «${target}» переведен в состояние: ${desiredState ? "ВКЛ" : "ВЫКЛ"}`);
    return;
  }

  // 7. Google AI (Gemini 3.5 Flash-Lite) Reasoning on Backend
  thoughtLog.addStep("ai", `Локальный фильтр не найден. Подключаю Google Gemini (Flash-Lite)...`);
  const availableFilters = Array.from(
    document.querySelectorAll('.FiltersListItem_root__UH0W8, [class*="FiltersListItem"]')
  )
    .slice(0, 30)
    .map((n) => n.textContent?.replace(/\d+$/, "").trim())
    .filter(Boolean);

  const plan = await requestActionPlan(query, "bro", availableFilters, pageContext.type);
  if (plan && plan.steps && plan.steps.length > 0) {
    if (plan.thought) thoughtLog.addStep("ai", plan.thought);
    if (plan.speech) actor.speak(plan.speech);

    let anySuccess = false;
    for (const step of plan.steps) {
      if (step.action === "set_price" && step.value) {
        const ok = setPriceLimit(step.value, document, onStep);
        if (ok) anySuccess = true;
      } else if (step.action === "toggle_filter" && step.value) {
        const ok = await actor.toggleSemanticFilter(step.value, true, onStep);
        if (ok) anySuccess = true;
      } else if (step.action === "set_sort" && step.value) {
        const ok = setSortOption(step.value, document);
        if (ok) anySuccess = true;
      } else if (step.action === "set_destination" && step.value) {
        const ok = await executeDestinationSearch(step.value, actor, thoughtLog);
        if (ok) anySuccess = true;
      }
    }

    if (anySuccess) {
      thoughtLog.addStep("success", "План от Google Gemini успешно выполнен");
      return;
    }
  }

  // 8. Destination Search Fallback
  thoughtLog.addStep("dom", `Проверяю поле ввода направления для: «${target}»...`);
  const destDone = await executeDestinationSearch(target, actor, thoughtLog);
  if (destDone) return;

  // 9. Informative Failure (No Silence, No Fatality)
  thoughtLog.addStep("error", `Действие для «${query}» не удалось сопоставить с элементами страницы.`);
  actor.speak(`Не удалось найти фильтр или действие для «${target || query}».`);
}

async function executeDestinationSearch(target, actor, thoughtLog) {
  const searchSummary = document.querySelector('.SearchInfo_wrapper__iCRSw, [class*="SearchInfo"]');
  if (searchSummary && !document.querySelector('[data-testid="destination-input"]')) {
    searchSummary.click();
    await new Promise((r) => setTimeout(r, 400));
  }

  const destInput = document.querySelector(
    '[data-testid="destination-input"], input[placeholder*="Куда"], input[name="destination"], input[placeholder*="Город"]'
  );

  if (!destInput) return false;

  thoughtLog.addStep("action", `Ввожу направление «${target}» в поисковую строку`);
  await actor.flyToElement(destInput, `Ввожу: ${target}`);
  await actor.smoothType(destInput, target);

  await new Promise((r) => setTimeout(r, 600));
  const suggest = document.querySelector('[class*="Suggest"] [role="option"], [class*="Suggest"] li, [class*="PlaceSuggest"] li');
  if (suggest) {
    suggest.click();
    thoughtLog.addStep("dom", "Выбран вариант из автодополнения");
  }

  const searchBtn = document.querySelector('[data-testid="search-button"], button[type="submit"]');
  if (searchBtn) {
    await actor.flyToElement(searchBtn, "Запускаю поиск!");
    searchBtn.click();
    thoughtLog.addStep("success", `Поиск по направлению «${target}» успешно запущен!`);
    return true;
  }
  return false;
}
