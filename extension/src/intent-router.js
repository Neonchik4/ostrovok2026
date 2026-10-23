/**
 * Intent Router & Wild Query Resolver
 * Dispatches arbitrary user queries (prices, distance, sorting, filters, destinations)
 * with step-by-step SSE thoughts streamed into ThoughtLog.
 */
import { setDistanceLimit, setPriceLimit, setSortOption } from "./semantic-dom.js";
import { speakAloud } from "./voice.js";

export function extractTargetEntity(rawText) {
  return rawText
    .toLowerCase()
    .replace(/^(найди|поищи|включи|поставь|выбери|добавь|покажи|отметь)\s+/i, "")
    .replace(/\s+(и\s+включи|и\s+выбери|и\s+найди|фильтр|чекбокс)$/i, "")
    .replace(/^(отель\s+в\s+|отели\s+в\s+|район\s+|достопримечательность\s+)/i, "")
    .trim();
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
      thoughtLog.addStep("dom", "Кнопка бронирования не найдена на текущем экране");
      actor.speak("Ищу кнопку бронирования на странице...");
    }
    return;
  }

  // 3. Price Filter Intent: "до 8000 руб", "дешевле 5000", "до 12000"
  const priceMatch = query.match(/(?:до|дешевле|не дороже|цена до)\s*(\d[\d\s]*)/i);
  if (priceMatch) {
    const rawVal = parseInt(priceMatch[1].replace(/\s+/g, ""), 10);
    if (rawVal > 0) {
      thoughtLog.addStep("dom", `Обнаружен фильтр цены: до ${rawVal} ₽`);
      const targetInput = document.querySelector('#price_to, input[name="price_to"]');
      if (targetInput) await actor.flyToElement(targetInput, `Ставлю цену до ${rawVal} ₽`);
      const ok = setPriceLimit(rawVal, document);
      if (ok) {
        thoughtLog.addStep("success", `Слайдер и инпут цены выставлены на ${rawVal} ₽`);
        actor.speak(`Цена до ${rawVal} ₽ установлена!`);
        return;
      }
    }
  }

  // 4. Distance Filter Intent: "до 5 км", "до 3 км от центра"
  const distMatch = query.match(/(?:до|ближе чем)\s*(\d+)\s*км/i);
  if (distMatch) {
    const km = parseInt(distMatch[1], 10);
    thoughtLog.addStep("dom", `Обнаружен фильтр расстояния: до ${km} км`);
    const distEl = document.querySelector('#distance_filter\\.field');
    if (distEl) await actor.flyToElement(distEl, `Ставлю расстояние: ${km} км`);
    const ok = setDistanceLimit(km, document);
    if (ok) {
      thoughtLog.addStep("success", `Фильтр расстояния установлен на ${km} км`);
      actor.speak(`Расстояние до ${km} км установлено!`);
      return;
    }
  }

  // 5. Sorting Intent: "сначала дешевые", "по рейтингу", "по расстоянию"
  if (/сначала дешев|подешев|по оценк|по рейтинг|по расстоян/i.test(query)) {
    const hint = /дешев/i.test(query) ? "дешев" : /оценк|рейтинг/i.test(query) ? "оценк" : "расстоян";
    thoughtLog.addStep("dom", `Настройка сортировки выдачи: ${hint}`);
    const ok = setSortOption(hint, document);
    if (ok) {
      thoughtLog.addStep("success", "Сортировка выдачи успешно изменена");
      actor.speak("Сортировка обновлена!");
      return;
    }
  }

  // 6. Arbitrary Filter, Neighborhood or Attraction (e.g. "найди Лазаревское и включи", "Чистяковская роща")
  const target = extractTargetEntity(query);
  const desiredState = !/выключ|сними|убери|отключ/i.test(query);

  thoughtLog.addStep("dom", `Сканирую боковые фильтры на предмет: "${target}"...`);

  const filterMatched = await actor.toggleSemanticFilter(target, desiredState);
  if (filterMatched) {
    thoughtLog.addStep("success", `Фильтр «${target}» успешно переведен в состояние: ${desiredState ? "ВКЛ" : "ВЫКЛ"}`);
    return;
  }

  // 7. Destination Search fallback: searching for a new city/resort
  thoughtLog.addStep("dom", `«${target}» не найден в фильтрах текущей страницы. Проверяю поисковую строку направления...`);

  const searchSummary = document.querySelector('.SearchInfo_wrapper__iCRSw, [class*="SearchInfo"]');
  if (searchSummary && !document.querySelector('[data-testid="destination-input"]')) {
    searchSummary.click();
    await new Promise((r) => setTimeout(r, 400));
  }

  let destInput = document.querySelector(
    '[data-testid="destination-input"], input[placeholder*="Куда"], input[name="destination"], input[placeholder*="Город"]'
  );

  if (destInput) {
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
    }
    return;
  }

  // 8. Fallback
  thoughtLog.addStep("action", `Выполняю общий запрос: ${query}`);
  actor.speak(`Ищу: ${target || query}`);
}
