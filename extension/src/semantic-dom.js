/**
 * Semantic DOM Matcher for Ostrovok.ru
 * Dynamically finds and interacts with filters, sliders, numeric inputs, and sorting without hardcoded classes.
 */

export function cleanQuery(rawText) {
  return rawText
    .toLowerCase()
    .replace(/^(найди|поищи|включи|поставь|выбери|добавь|покажи|отметь)\s+/i, "")
    .replace(/\s+(и\s+включи|и\s+выбери|и\s+найди|фильтр|чекбокс|галочку)$/i, "")
    .trim();
}

export function findFilterElement(targetName, doc = document) {
  const query = cleanQuery(targetName);
  if (!query) return null;

  // 1. First pass: look through visible labels & checkboxes
  let match = searchVisibleLabels(query, doc);
  if (match) return match;

  // 2. Second pass: expand spoiler buttons ("Показать еще") and retry
  const spoilerButtons = Array.from(
    doc.querySelectorAll('button[class*="SpoilerButton"], button[class*="showMore"], button')
  ).filter((b) => /показать еще/i.test(b.textContent || ""));

  for (const btn of spoilerButtons) {
    try {
      btn.click();
    } catch {
      // Ignore click issues
    }
  }

  // Search again after expanding
  return searchVisibleLabels(query, doc);
}

function searchVisibleLabels(query, doc = document) {
  const candidateLabels = Array.from(
    doc.querySelectorAll(
      '.FiltersListItem_root__UH0W8, [class*="FiltersListItem"], label, [role="checkbox"]'
    )
  );

  // Exact substring match
  for (const item of candidateLabels) {
    const text = (item.textContent || "").toLowerCase().trim();
    if (text.includes(query)) {
      const input = item.querySelector("input[type='checkbox']") || (item.tagName === "INPUT" ? item : null);
      return { container: item, input, text };
    }
  }

  // Token word match
  const tokens = query.split(/\s+/).filter((t) => t.length > 2);
  for (const item of candidateLabels) {
    const text = (item.textContent || "").toLowerCase();
    if (tokens.every((t) => text.includes(t))) {
      const input = item.querySelector("input[type='checkbox']") || (item.tagName === "INPUT" ? item : null);
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

/**
 * Universal Slider & Numeric Price Filter
 */
export function setPriceLimit(maxPrice, doc = document) {
  const priceInput = doc.querySelector('#price_to, input[name="price_to"], input[id*="price_to"]');
  if (!priceInput) return false;

  priceInput.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const formatted = `${maxPrice} ₽`;
  if (setter) setter.call(priceInput, formatted);
  else priceInput.value = formatted;

  priceInput.dispatchEvent(new Event("input", { bubbles: true }));
  priceInput.dispatchEvent(new Event("change", { bubbles: true }));
  priceInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  // Update slider thumb visual if present
  const thumb = doc.querySelectorAll('[role="slider"]')[1];
  if (thumb) thumb.setAttribute("aria-valuenow", String(maxPrice));

  return true;
}

/**
 * Universal Distance Filter (Slider & Input)
 */
export function setDistanceLimit(maxKm, doc = document) {
  const distInput = doc.querySelector('#distance_filter\\.field, input[name*="distance"]');
  if (!distInput) return false;

  distInput.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const formatted = `${maxKm} км`;
  if (setter) setter.call(distInput, formatted);
  else distInput.value = formatted;

  distInput.dispatchEvent(new Event("input", { bubbles: true }));
  distInput.dispatchEvent(new Event("change", { bubbles: true }));
  distInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  const thumb = doc.querySelector('.DistanceFilter_root__gph2_ ~ .Slider_track__tp_xu [role="slider"]');
  if (thumb) thumb.setAttribute("aria-valuenow", String(maxKm));

  return true;
}

/**
 * Universal Sort Order Selector
 */
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
