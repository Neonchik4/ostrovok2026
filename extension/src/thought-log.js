/**
 * Wild Thought Stream Logger UI
 * Streams and visualizes real-time reasoning and DOM actions above the Action Bar.
 */

export class ThoughtLog {
  constructor(shadowRoot) {
    this.root = shadowRoot;
    this.container = null;
    this.listEl = null;
    this.hideTimeout = null;
    this.init();
  }

  init() {
    this.container = document.createElement("div");
    this.container.className = "copilot-thought-log";
    this.container.innerHTML = `
      <div class="thought-log-header">
        <div class="thought-log-title">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span>Ход мыслей агента (SSE Stream)</span>
        </div>
        <div class="thought-live-badge">
          <span class="thought-live-dot"></span>
          <span>LIVE</span>
        </div>
      </div>
      <div class="thought-log-list" id="thought-log-list"></div>
    `;
    this.listEl = this.container.querySelector("#thought-log-list");
    this.root.appendChild(this.container);
  }

  show() {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.container.classList.add("visible");
  }

  hide(delayMs = 0) {
    if (delayMs > 0) {
      if (this.hideTimeout) clearTimeout(this.hideTimeout);
      this.hideTimeout = setTimeout(() => {
        this.container.classList.remove("visible");
      }, delayMs);
    } else {
      this.container.classList.remove("visible");
    }
  }

  clear() {
    if (this.listEl) this.listEl.innerHTML = "";
  }

  addStep(tag, text) {
    this.show();
    if (!this.listEl) return;

    const item = document.createElement("div");
    item.className = "thought-log-item";

    const tagClass = ["intent", "dom", "action", "success"].includes(tag) ? tag : "dom";
    const tagLabel = tag === "intent" ? "ИНТЕНТ" : tag === "dom" ? "DOM" : tag === "action" ? "ДЕЙСТВИЕ" : "РЕЗУЛЬТАТ";

    item.innerHTML = `
      <span class="thought-tag ${tagClass}">[${tagLabel}]</span>
      <span class="thought-text">${text}</span>
    `;

    this.listEl.appendChild(item);
    this.listEl.scrollTop = this.listEl.scrollHeight;

    // Reset auto-hide timer: keep visible for 6 seconds after last step
    this.hide(6000);
  }
}
