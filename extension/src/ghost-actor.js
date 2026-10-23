/**
 * Ghost Actor & Flying Flight Engine
 * Animates ghost across viewport, physically hovering over inputs, filters, sliders, and cards.
 * Triggers real Ostrovok booking navigation.
 */

export class GhostActor {
  constructor(flyerElement, ghostCanvas, thoughtBubbleElement) {
    this.flyer = flyerElement;
    this.ghost = ghostCanvas;
    this.bubble = thoughtBubbleElement;
    this.homeCoords = { right: 28, bottom: 28 };
    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;
    this.currentCoords = { x: winW - 90, y: winH - 90 };
  }

  speak(text, durationMs = 3500) {
    if (!this.bubble) return;
    this.bubble.textContent = text;
    this.bubble.classList.add("visible");
    this.ghost.setState("speaking");

    if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
    if (durationMs > 0) {
      this.bubbleTimeout = setTimeout(() => {
        this.bubble.classList.remove("visible");
        this.ghost.setState("idle");
      }, durationMs);
    }
  }

  async flyTo(targetX, targetY, speechText = "") {
    if (speechText) this.speak(speechText, 3000);

    const startX = this.currentCoords.x;
    const dx = targetX - startX;

    // Set flight lean & state
    this.ghost.setState("flying");
    const tilt = Math.max(-0.3, Math.min(0.3, dx * 0.0015));
    this.ghost.setTilt(tilt);

    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;

    // Position flyer element via fixed styles
    this.flyer.style.left = `${Math.max(16, Math.min(winW - 80, targetX))}px`;
    this.flyer.style.top = `${Math.max(16, Math.min(winH - 80, targetY))}px`;
    this.flyer.style.right = "auto";
    this.flyer.style.bottom = "auto";

    this.currentCoords = { x: targetX, y: targetY };

    // Wait for transition to complete
    await new Promise((r) => setTimeout(r, 680));

    this.ghost.setTilt(0);
    this.ghost.setState("happy");
    await new Promise((r) => setTimeout(r, 200));
    this.ghost.setState("idle");
  }

  async flyToElement(element, speechText = "") {
    if (!element) return;
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise((r) => setTimeout(r, 350));
    }

    const rect = typeof element.getBoundingClientRect === "function"
      ? element.getBoundingClientRect()
      : { right: 100, top: 100 };
    const targetX = rect.right + 12;
    const targetY = rect.top - 18;

    await this.flyTo(targetX, targetY, speechText);
    this.pulseElement(element);
  }

  async returnHome(speechText = "") {
    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;
    const targetX = winW - 90;
    const targetY = winH - 90;
    await this.flyTo(targetX, targetY, speechText);
  }

  pulseElement(element) {
    if (!element || !element.classList) return;
    element.classList.add("ostrovok-copilot-targeted");
    setTimeout(() => {
      element.classList.remove("ostrovok-copilot-targeted");
    }, 1200);
  }

  async smoothType(inputEl, text, charDelay = 40) {
    if (!inputEl) return;
    if (typeof inputEl.focus === "function") inputEl.focus();
    let current = "";
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

    for (const char of text) {
      current += char;
      if (setter) setter.call(inputEl, current);
      else inputEl.value = current;
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, charDelay));
    }
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async toggleFilterCheckbox(filterName) {
    const labels = Array.from(document.querySelectorAll("label, [role='checkbox'], [class*='FilterCheckbox'], [class*='Control_label']"));
    const target = labels.find((l) => new RegExp(filterName, "i").test(l.textContent || ""));

    if (target) {
      await this.flyToElement(target, `Включаю фильтр: ${filterName}`);
      const clickable = target.querySelector("input[type='checkbox']") || target;
      clickable.click();
      return true;
    }
    return false;
  }

  async highlightRoomOffer(room) {
    if (!room || !room.el) return;
    await this.flyToElement(room.el, "Выбрал лучший тариф с завтраком!");

    // Add badge to room row
    let badge = room.el.querySelector(".ostrovok-copilot-room-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "ostrovok-copilot-room-badge";
      badge.textContent = "Рекомендация Copilot: Выгодный тариф";
      room.el.prepend(badge);
    }

    const bookBtn = room.el.querySelector("button, [class*='Button'], a[href*='book']");
    if (bookBtn) this.pulseElement(bookBtn);
  }

  async bookRoomOnOstrovok(room) {
    let bookBtn = room?.el?.querySelector("button, [class*='Button'], a[href*='order'], a[href*='book']");
    if (!bookBtn) {
      bookBtn = document.querySelector('[data-testid*="book-button"], button[class*="BookButton"], a[href*="/order/"]');
    }

    if (bookBtn) {
      await this.flyToElement(bookBtn, "Перехожу к бронированию на Островке!");
      this.pulseElement(bookBtn);
      await new Promise((r) => setTimeout(r, 400));
      bookBtn.click();
      return true;
    }
    return false;
  }

  async highlightHotelCard(cardEl, matchText = "98% совпадение • Лучший по отзывам") {
    if (!cardEl) return;
    await this.flyToElement(cardEl, matchText);

    let badge = cardEl.querySelector(".ostrovok-copilot-injected-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "ostrovok-copilot-injected-badge";
      badge.innerHTML = `<span class="badge-dot"></span><span class="badge-text">${matchText}</span>`;
      cardEl.appendChild(badge);
    }
    cardEl.style.borderColor = "#1652F0";
    cardEl.style.boxShadow = "0 0 0 2px #1652F0, 0 12px 32px rgba(22, 82, 240, 0.22)";
  }
}
