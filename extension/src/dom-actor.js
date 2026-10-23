/**
 * DOM Actor & Scraper
 * Safely executes actions on live Ostrovok DOM using native React event dispatching.
 */

export function setReactInputValue(inputEl, text) {
  if (!inputEl) return;
  inputEl.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (setter) {
    setter.call(inputEl, text);
  } else {
    inputEl.value = text;
  }
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  inputEl.dispatchEvent(new Event("change", { bubbles: true }));
}

export async function smoothTypeInput(inputEl, text, charDelayMs = 45) {
  if (!inputEl) return;
  inputEl.focus();
  let current = "";
  for (const char of text) {
    current += char;
    setReactInputValue(inputEl, current);
    await new Promise((r) => setTimeout(r, charDelayMs));
  }
}

export async function executeStep(step, spotlight) {
  const { action, selector, value } = step;

  switch (action) {
    case "set_destination": {
      const input = document.querySelector(selector || '[data-testid="destination-input"]');
      if (input) {
        await spotlight.moveToElement(input, 500);
        spotlight.pulseClick();
        await smoothTypeInput(input, value || "Сочи");

        // Wait for autocomplete suggestion dropdown and click first option if available
        await new Promise((r) => setTimeout(r, 600));
        const suggestOption = document.querySelector('[class*="PlaceSuggest_root"] [role="option"], [class*="PlaceSuggest_root"] li');
        if (suggestOption) {
          suggestOption.click();
        }
      }
      break;
    }

    case "submit_search": {
      const btn = document.querySelector(selector || '[data-testid="search-button"]');
      if (btn) {
        await spotlight.moveToElement(btn, 450);
        spotlight.pulseClick();
        btn.click();
      }
      break;
    }

    case "scroll_to_hotel": {
      const cards = document.querySelectorAll(selector || '[data-testid="serp-hotelcard"]');
      const idx = parseInt(value, 10) || 0;
      const targetCard = cards[idx] || cards[0];
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
        await spotlight.moveToElement(targetCard, 600);
        spotlight.pulseClick();
      }
      break;
    }

    case "highlight_hotel": {
      const cards = document.querySelectorAll(selector || '[data-testid="serp-hotelcard"]');
      const targetCard = cards[0];
      if (targetCard) {
        attachMatchBadge(targetCard, value || "96% совпадение • Подогреваемый бассейн");
      }
      break;
    }

    default:
      break;
  }
}

export function attachMatchBadge(cardElement, text) {
  if (!cardElement) return;

  // Remove existing badge if already present
  const existing = cardElement.querySelector(".ostrovok-copilot-injected-badge");
  if (existing) existing.remove();

  // Add blue focus glow
  cardElement.style.transition = "box-shadow 0.4s ease, border-color 0.4s ease";
  cardElement.style.borderColor = "#1652F0";
  cardElement.style.boxShadow = "0 0 0 2px #1652F0, 0 12px 32px rgba(22, 82, 240, 0.22)";

  // Badge container
  const badge = document.createElement("div");
  badge.className = "ostrovok-copilot-injected-badge";
  badge.innerHTML = `
    <span class="badge-dot"></span>
    <span class="badge-text">${text}</span>
  `;
  cardElement.appendChild(badge);
}

export function scrapeTopHotel() {
  const card = document.querySelector('[data-testid="serp-hotelcard"]');
  if (!card) return null;

  const name = card.querySelector('[data-testid="hotel-card-name"]')?.textContent?.trim() || "Отель в Сочи";
  const price = card.querySelector('[data-testid="hotel-card-price-value"]')?.textContent?.trim() || "от 3 471 ₽";
  const rating = card.querySelector('[data-testid="hotel-card-rating"]')?.textContent?.trim() || "9.1";
  const imgEl = card.querySelector("img");
  const imgSrc = imgEl?.src || "";

  return { name, price, rating, imgSrc };
}
