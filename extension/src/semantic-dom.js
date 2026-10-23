/**
 * Semantic DOM Matcher for Ostrovok.ru
 * Dynamically finds and interacts with filters, sliders, numeric inputs, and sorting without hardcoded classes.
 */

export function getRussianStem(word) {
  if (!word || typeof word !== "string") return "";
  let w = word.toLowerCase().trim();
  if (w.length <= 3) return w;
  w = w.replace(
    /(овского|евского|овскому|евскому|овским|евским|овском|евском|овская|евская|овское|евское|овской|евской|овские|евские|овских|евских|ов|ев|иями|ями|ами|ого|его|ому|ему|ыми|ими|ей|ой|ем|ом|ым|им|ам|ям|ах|ях|ую|юю|ое|ее|ие|ые|ых|их|ая|яя|ий|ый|ой|ин|на|но|ны|а|я|у|ю|е|о|ы|и)$/i,
    ""
  );
  return w.length >= 3 ? w : word.toLowerCase().trim();
}

export function cleanQuery(rawText) {
  if (!rawText) return "";
  return rawText
    .toLowerCase()
    .replace(/^(найди|поищи|найти|включи|включить|поставь|поставить|выбери|выбрать|добавь|добавить|покажи|показать|отметь|отметить|активируй|активировать|сними|снять|убери|убрать|отключи|отключить)\s+/i, "")
    .replace(/\s+(и\s+включи|и\s+включить|и\s+выбери|и\s+выбрать|и\s+найди|и\s+найти|фильтр|чекбокс|галочку|галочка)$/i, "")
    .replace(/^(отель\s+в\s+|отели\s+в\s+|гостиница\s+в\s+|район\s+|достопримечательность\s+|пляж\s+|улица\s+)/i, "")
    .replace(/^(с|со|без|в|во|на|под|от|до|для|около|у|к|по)\s+/i, "")
    .trim();
}

export function parsePriceRangeIntent(query) {
  if (!query) return null;
  const q = query.toLowerCase();
  let minPrice = null;
  let maxPrice = null;

  // 1. "от X до Y"
  const rangeMatch = q.match(/(?:от\s*(\d[\d\s]*))\s*(?:до|-)\s*(\d[\d\s]*)/i);
  if (rangeMatch) {
    minPrice = parseInt(rangeMatch[1].replace(/\s+/g, ""), 10);
    maxPrice = parseInt(rangeMatch[2].replace(/\s+/g, ""), 10);
    return { minPrice, maxPrice };
  }

  // 2. Explicit min price: "минимальная", "мин", "от", "не меньше"
  const minMatch = q.match(/(?:минимальн[а-яё]*|мин\b|не меньше|не дешевле|(?:^|\s)от)\s*(?:цен[а-яё]*|стоимост[а-яё]*)?\s*(\d[\d\s]*)/iu);
  if (minMatch) {
    const val = parseInt(minMatch[1].replace(/\s+/g, ""), 10);
    if (val >= 100) minPrice = val;
  }

  // 3. Explicit max price: "максимальная", "макс", "до", "не дороже", "дешевле", "бюджет"
  const maxMatch = q.match(/(?:максимальн[а-яё]*|макс\b|не дороже|не больше|дешевле|бюджет|(?:^|\s)до)\s*(?:цен[а-яё]*|стоимост[а-яё]*)?\s*(\d[\d\s]*)/iu);
  if (maxMatch) {
    const val = parseInt(maxMatch[1].replace(/\s+/g, ""), 10);
    if (val >= 100) maxPrice = val;
  }

  // 4. Generic price given without explicit min/max markers: defaults to maxPrice
  if (minPrice === null && maxPrice === null) {
    let genericMatch = q.match(/(?:цена|цену|стоимость)\s*(\d[\d\s]*)/i);
    if (genericMatch) {
      const val = parseInt(genericMatch[1].replace(/\s+/g, ""), 10);
      if (val >= 100) maxPrice = val;
    } else {
      genericMatch = q.match(/(\d[\d\s]*)\s*(?:₽|руб|рублей|р\b)/i);
      if (genericMatch) {
        const val = parseInt(genericMatch[1].replace(/\s+/g, ""), 10);
        if (val >= 100) maxPrice = val;
      } else {
        genericMatch = q.trim().match(/^(\d[\d\s]*)$/);
        if (genericMatch) {
          const val = parseInt(genericMatch[1].replace(/\s+/g, ""), 10);
          if (val >= 500) maxPrice = val;
        }
      }
    }
  }

  if (minPrice !== null || maxPrice !== null) {
    return { minPrice, maxPrice };
  }
  return null;
}

export function parsePriceIntent(query) {
  const range = parsePriceRangeIntent(query);
  return range?.maxPrice || range?.minPrice || null;
}

const SEMANTIC_FILTER_MAP = {
  завтрак: ["breakfast", "halfboard", "fullboard"],
  бассейн: ["has_pool", "pool"],
  парковк: ["has_parking", "parking"],
  вайфай: ["has_wifi", "wifi", "internet"],
  интернет: ["has_wifi", "wifi", "internet"],
  питомц: ["pets", "allow_pets"],
  животн: ["pets", "allow_pets"],
  собак: ["pets", "allow_pets"],
  кондиционер: ["air_conditioning", "ac"],
  пляж: ["beach", "first_line"],
  спа: ["spa", "sauna"],
  кухн: ["kitchen"],
};

export function findFilterElement(targetName, doc = document, onStep = null) {
  const query = cleanQuery(targetName);
  if (!query) return null;

  let match = searchVisibleLabels(query, doc, onStep);
  if (match) return match;

  const spoilerButtons = Array.from(
    doc.querySelectorAll('button[class*="SpoilerButton"], button[class*="showMore"], button')
  ).filter((b) => /показать еще/i.test(b.textContent || ""));

  if (spoilerButtons.length > 0 && onStep) {
    onStep("dom", `Раскрываю ${spoilerButtons.length} скрытых секций фильтров ("Показать еще")...`);
  }

  for (const btn of spoilerButtons) {
    try {
      btn.click();
    } catch {
      // Ignore click issues
    }
  }

  return searchVisibleLabels(query, doc, onStep);
}

function searchVisibleLabels(query, doc = document, onStep = null) {
  const candidateLabels = Array.from(
    doc.querySelectorAll(
      '.FiltersListItem_root__UH0W8, [class*="FiltersListItem"], [class*="SwitchableFilter"], label, [role="checkbox"]'
    )
  );

  if (onStep) {
    onStep("dom", `Сканирую ${candidateLabels.length} элементов фильтров на странице для: «${query}»`);
  }

  const queryTokens = query.split(/\s+/).filter((t) => t.length >= 2);
  const queryStems = queryTokens.map(getRussianStem);

  for (const item of candidateLabels) {
    const input = item.querySelector("input[type='checkbox']") || (item.tagName === "INPUT" ? item : null);
    if (input) {
      const val = (input.value || "").toLowerCase();
      const name = (input.name || "").toLowerCase();
      const id = (input.id || "").toLowerCase();

      for (const stem of queryStems) {
        const aliases = SEMANTIC_FILTER_MAP[stem] || [];
        if (aliases.some((a) => val.includes(a) || name.includes(a) || id.includes(a))) {
          const text = (item.textContent || "").toLowerCase().trim();
          if (onStep) onStep("dom", `Найдено семантическое соответствие [value="${val}"]`);
          return { container: item, input, text };
        }
      }
    }
  }

  for (const item of candidateLabels) {
    const text = (item.textContent || "").toLowerCase().trim();
    if (text.includes(query)) {
      const input = item.querySelector("input[type='checkbox']") || (item.tagName === "INPUT" ? item : null);
      if (onStep) onStep("dom", `Найдено точное текстовое совпадение: «${text.slice(0, 35)}»`);
      return { container: item, input, text };
    }
  }

  for (const item of candidateLabels) {
    const text = (item.textContent || "").toLowerCase().replace(/\d+$/, "").trim();
    const labelTokens = text.split(/[\s,.-]+/).filter((t) => t.length >= 2);
    const labelStems = labelTokens.map(getRussianStem);

    const allMatched = queryStems.every((qs) =>
      text.includes(qs) || labelStems.some((ls) => ls.includes(qs) || qs.includes(ls))
    );

    if (allMatched && labelTokens.length > 0) {
      const input = item.querySelector("input[type='checkbox']") || (item.tagName === "INPUT" ? item : null);
      if (onStep) onStep("dom", `Совпадение по корню слова: «${text.slice(0, 35)}»`);
      return { container: item, input, text };
    }
  }

  return null;
}

export function setCheckboxSemanticState(inputEl, containerEl, desiredState = true) {
  if (!inputEl) {
    if (containerEl) containerEl.click();
    return { changed: true, alreadyInState: false };
  }

  const isChecked = Boolean(inputEl.checked);
  if (isChecked === desiredState) {
    return { changed: false, alreadyInState: true };
  }

  const clickable = containerEl?.querySelector("label") || containerEl || inputEl;
  clickable.click();
  return { changed: true, alreadyInState: false };
}

function setSinglePriceInput(inputEl, priceNum, isMin, doc, onStep) {
  if (!inputEl) return false;

  const formatted = `${priceNum} ₽`;
  if (onStep) {
    onStep("dom", `Найден инпут #${inputEl.id} (${isMin ? "От" : "До"}), текущее: "${inputEl.value}"`);
  }

  inputEl.focus();

  if (inputEl._valueTracker) {
    inputEl._valueTracker.setValue("" + Math.random());
  }

  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (setter) {
    setter.call(inputEl, formatted);
  } else {
    inputEl.value = formatted;
  }

  inputEl.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  inputEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
  inputEl.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, bubbles: true }));

  inputEl.blur();
  inputEl.dispatchEvent(new FocusEvent("blur", { bubbles: true, composed: true }));

  const wrapper = inputEl.closest("label, .InputBase_wrapper___7Lrs, .PriceFilter_inputs__PuZp0") || inputEl;
  wrapper.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  if (onStep) {
    onStep("action", `Установлено значение: ${formatted} в #${inputEl.id} (без необходимости ручного клика)`);
  }

  const thumbs = doc.querySelectorAll('[role="slider"]');
  const thumb = isMin ? thumbs[0] : thumbs[1];
  if (thumb) thumb.setAttribute("aria-valuenow", String(priceNum));

  return true;
}

export function applyPriceRange(minPrice, maxPrice, doc = document, onStep = null) {
  let anySuccess = false;

  if (minPrice !== null && minPrice !== undefined) {
    const minInput = doc.querySelector('#price_from, input[name="price_from"], input[id*="price_from"]');
    if (minInput) {
      const ok = setSinglePriceInput(minInput, minPrice, true, doc, onStep);
      if (ok) anySuccess = true;
    } else if (onStep) {
      onStep("error", "Инпут минимальной цены #price_from не найден");
    }
  }

  if (maxPrice !== null && maxPrice !== undefined) {
    const maxInput = doc.querySelector('#price_to, input[name="price_to"], input[id*="price_to"]');
    if (maxInput) {
      const ok = setSinglePriceInput(maxInput, maxPrice, false, doc, onStep);
      if (ok) anySuccess = true;
    } else if (onStep) {
      onStep("error", "Инпут максимальной цены #price_to не найден");
    }
  }

  if (anySuccess) {
    const container = doc.querySelector('.PriceFilter_inputs__PuZp0, [class*="PriceFilter"]') || doc.body;
    container.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  return anySuccess;
}

export function setPriceLimit(maxPrice, doc = document, onStep = null) {
  return applyPriceRange(null, maxPrice, doc, onStep);
}

export function setDistanceLimit(maxKm, doc = document, onStep = null) {
  const distInput = doc.querySelector('#distance_filter\\.field, input[name*="distance"]');
  if (!distInput) {
    if (onStep) onStep("error", "Инпут фильтра расстояния не найден");
    return false;
  }

  distInput.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const formatted = `${maxKm} км`;
  if (setter) setter.call(distInput, formatted);
  else distInput.value = formatted;

  distInput.dispatchEvent(new Event("input", { bubbles: true }));
  distInput.dispatchEvent(new Event("change", { bubbles: true }));
  distInput.dispatchEvent(new Event("blur", { bubbles: true }));
  distInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  const thumb = doc.querySelector('.DistanceFilter_root__gph2_ ~ .Slider_track__tp_xu [role="slider"]');
  if (thumb) thumb.setAttribute("aria-valuenow", String(maxKm));

  if (onStep) onStep("action", `Установлен лимит расстояния: ${maxKm} км`);
  return true;
}

export function setSortOption(sortHint, doc = document) {
  const container = doc.querySelector('[data-testid="sort-filter-field-container"], #sort-filter-select');
  if (!container) return false;

  const clickable = container.closest("label") || container;
  clickable.click();

  const options = Array.from(doc.querySelectorAll('[class*="option"], [role="option"], li'));
  const targetOption = options.find((opt) => new RegExp(sortHint, "i").test(opt.textContent || ""));
  if (targetOption) {
    targetOption.click();
    return true;
  }
  return false;
}
