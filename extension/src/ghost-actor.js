/**
 * Ghost Actor & Flying Flight Engine
 * Handles concise speech, flight physics, evasive dodge AFTER action completion,
 * and semantic filter execution.
 */
import { findFilterElement, setCheckboxSemanticState } from "./semantic-dom.js";

export function shortenText(text, maxChars = 50) {
  if (!text) return "";
  const cleaned = text.trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.substring(0, maxChars - 3) + "...";
}

export class GhostActor {
  constructor(flyerElement, ghostCanvas, thoughtBubbleElement) {
    this.flyer = flyerElement;
    this.ghost = ghostCanvas;
    this.bubble = thoughtBubbleElement;

    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;
    this.homeCoords = { x: winW - 90, y: winH - 90 };
    this.currentCoords = { x: winW - 90, y: winH - 90 };
    this.isDodging = false;
    this.isExecuting = false; // Busy lock: only dodge AFTER execution finishes!
  }

  speak(text, durationMs = 3200) {
    if (!this.bubble) return;
    const short = shortenText(text, 65);
    this.bubble.textContent = short;

    // Adjust alignment so speech bubble never overflows left or right boundaries
    this.bubble.classList.remove("align-center", "align-left");
    if (this.currentCoords.x < 260) {
      this.bubble.classList.add("align-left");
    } else if (this.currentCoords.x < window.innerWidth - 300) {
      this.bubble.classList.add("align-center");
    }

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
    if (speechText) this.speak(speechText, 2800);

    const startX = this.currentCoords.x;
    const dx = targetX - startX;

    this.ghost.setState("flying");
    const tilt = Math.max(-0.3, Math.min(0.3, dx * 0.0015));
    this.ghost.setTilt(tilt);

    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;

    this.flyer.style.left = `${Math.max(16, Math.min(winW - 80, targetX))}px`;
    this.flyer.style.top = `${Math.max(16, Math.min(winH - 80, targetY))}px`;
    this.flyer.style.right = "auto";
    this.flyer.style.bottom = "auto";

    this.currentCoords = { x: targetX, y: targetY };

    await new Promise((r) => setTimeout(r, 650));
    this.ghost.setTilt(0);
    this.ghost.setState("happy");
    await new Promise((r) => setTimeout(r, 180));
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
    this.homeCoords = { x: winW - 90, y: winH - 90 };
    await this.flyTo(this.homeCoords.x, this.homeCoords.y, speechText);
  }

  handleUserMouseMove(mouseX, mouseY) {
    // Rule: Dodge ONLY after action is completed (isExecuting === false)
    if (this.isExecuting || this.isDodging) return;

    const isAtHome =
      Math.abs(this.currentCoords.x - this.homeCoords.x) < 45 &&
      Math.abs(this.currentCoords.y - this.homeCoords.y) < 45;

    // Do not dodge if docked peacefully in home corner
    if (isAtHome) return;

    // If user's mouse approaches ghost within 80px while idle in page body, yield
    const dist = Math.hypot(mouseX - this.currentCoords.x, mouseY - this.currentCoords.y);
    if (dist < 80) {
      this.isDodging = true;
      this.returnHome("Уступаю место!").finally(() => {
        setTimeout(() => {
          this.isDodging = false;
        }, 800);
      });
    }
  }

  pulseElement(element) {
    if (!element || !element.classList) return;
    element.classList.add("ostrovok-copilot-targeted");
    setTimeout(() => {
      element.classList.remove("ostrovok-copilot-targeted");
    }, 1200);
  }

  async smoothType(inputEl, text, charDelay = 35) {
    if (!inputEl) return;
    this.isExecuting = true;
    try {
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
    } finally {
      this.isExecuting = false;
    }
  }

  async toggleSemanticFilter(targetName, desiredState = true) {
    this.isExecuting = true;
    try {
      const match = findFilterElement(targetName);
      if (!match) {
        this.speak(`Не нашел фильтр «${shortenText(targetName, 25)}»`);
        return false;
      }

      await this.flyToElement(match.container, `Лечу к фильтру: ${shortenText(targetName, 22)}`);
      const res = setCheckboxSemanticState(match.input, match.container, desiredState);

      if (res.alreadyInState) {
        this.speak(`Фильтр уже ${desiredState ? "включен" : "выключен"}!`);
      } else {
        this.speak(`${desiredState ? "Включил" : "Снял"}: ${shortenText(targetName, 25)}`);
      }

      this.pulseElement(match.container);
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  async highlightRoomOffer(room) {
    if (!room || !room.el) return;
    this.isExecuting = true;
    try {
      await this.flyToElement(room.el, "Выбрал лучший тариф с завтраком!");

      let badge = room.el.querySelector(".ostrovok-copilot-room-badge");
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "ostrovok-copilot-room-badge";
        badge.textContent = "Рекомендация Copilot";
        room.el.prepend(badge);
      }
    } finally {
      this.isExecuting = false;
    }
  }

  async bookRoomOnOstrovok(room) {
    this.isExecuting = true;
    try {
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
    } finally {
      this.isExecuting = false;
    }
  }
}
