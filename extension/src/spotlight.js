/**
 * Virtual Spotlight Cursor & Action Indicator
 * Animates a glowing cursor to elements, creating an intuitive copilot experience.
 */
export class SpotlightCursor {
  constructor(container) {
    this.container = container;
    this.cursorEl = null;
    this.createCursor();
  }

  createCursor() {
    this.cursorEl = document.createElement("div");
    this.cursorEl.className = "ostrovok-spotlight-cursor";
    this.cursorEl.innerHTML = `
      <div class="spotlight-ring"></div>
      <div class="spotlight-dot"></div>
    `;
    this.container.appendChild(this.cursorEl);
  }

  async moveToElement(targetEl, durationMs = 600) {
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    this.cursorEl.style.opacity = "1";
    this.cursorEl.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;

    return new Promise((resolve) => setTimeout(resolve, durationMs));
  }

  pulseClick() {
    if (!this.cursorEl) return;
    this.cursorEl.classList.add("clicking");
    setTimeout(() => {
      this.cursorEl.classList.remove("clicking");
    }, 400);
  }

  hide(delayMs = 400) {
    setTimeout(() => {
      if (this.cursorEl) this.cursorEl.style.opacity = "0";
    }, delayMs);
  }
}
