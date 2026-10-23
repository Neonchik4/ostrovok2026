/**
 * Wild Thought Stream Logger UI
 * Streams and visualizes real-time reasoning and DOM actions above the Action Bar.
 * Permanently visible during user session with manual close control.
 */

export class ThoughtLog {
  constructor(shadowRoot) {
    this.root = shadowRoot;
    this.container = null;
    this.listEl = null;
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
        <div class="thought-header-actions">
          <button type="button" class="thought-close-btn" id="thought-close-btn" title="Скрыть панель мыслей">×</button>
        </div>
      </div>
      <div class="thought-log-list" id="thought-log-list"></div>
    `;
    this.listEl = this.container.querySelector("#thought-log-list");

    const closeBtn = this.container.querySelector("#thought-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hide());
    }

    this.root.appendChild(this.container);
  }

  show() {
    this.container.classList.add("visible");
  }

  hide() {
    this.container.classList.remove("visible");
  }

  clear() {
    if (this.listEl) this.listEl.innerHTML = "";
  }

  addStep(tag, text) {
    this.show();
    if (!this.listEl) return;

    const item = document.createElement("div");
    item.className = "thought-log-item";

    const tagClass = ["intent", "dom", "action", "success", "scan", "error", "ai"].includes(tag) ? tag : "dom";
    const tagLabels = {
      intent: "ИНТЕНТ",
      dom: "DOM",
      scan: "СКАНЕР",
      action: "ДЕЙСТВИЕ",
      success: "РЕЗУЛЬТАТ",
      error: "ОШИБКА",
      ai: "GEMINI AI",
    };
    const tagLabel = tagLabels[tagClass] || "DOM";

    item.innerHTML = `
      <span class="thought-tag ${tagClass}">[${tagLabel}]</span>
      <span class="thought-text">${text}</span>
    `;

    this.listEl.appendChild(item);
    this.listEl.scrollTop = this.listEl.scrollHeight;
  }
}
