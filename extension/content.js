/**
 * Ostrovok Muse Copilot - Content Script (Manifest V3)
 * Dynamic Semantic Adaptation, Wild Thought Logging & Voice Synthesis.
 */
import { GhostActor } from "./src/ghost-actor.js";
import { GhostCanvas } from "./src/ghost-canvas.js";
import { routeUserIntent } from "./src/intent-router.js";
import { detectPageContext, getContextualChips } from "./src/page-analyzer.js";
import { ThoughtLog } from "./src/thought-log.js";
import { VoiceController } from "./src/voice.js";

(function initOstrovokCopilot() {
  function start() {
    if (document.getElementById("ostrovok-copilot-shadow-host")) return;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", start);
      return;
    }

    const host = document.createElement("div");
    host.id = "ostrovok-copilot-shadow-host";
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    // Stylesheet
    const styleLink = document.createElement("link");
    styleLink.rel = "stylesheet";
    styleLink.href = chrome.runtime.getURL("styles.css");
    shadow.appendChild(styleLink);

  // Injected UI elements
  const container = document.createElement("div");
  container.innerHTML = `
    <!-- Flying Mascot -->
    <div class="ostrovok-ghost-flyer" id="ghost-flyer" title="Нажмите, чтобы открыть меню агента">
      <div class="ghost-thought-bubble" id="ghost-bubble">Привет!</div>
      <canvas class="ghost-canvas" id="ghost-canvas" width="60" height="60"></canvas>
    </div>

    <!-- Floating Action Island / Bar (Hidden by default, opens on ghost click) -->
    <div class="copilot-action-bar" id="action-bar">
      <div class="action-bar-label">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>Агент</span>
      </div>

      <div class="action-chips" id="action-chips"></div>

      <form class="action-input-form" id="action-form">
        <input type="text" class="action-input" id="action-input" placeholder="Команда агенту..." maxlength="250" />
        <button type="button" class="icon-btn" id="voice-btn" title="Голосовой ввод">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <button type="submit" class="submit-btn" id="action-submit" title="Выполнить">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
    </div>
  `;
  shadow.appendChild(container);

  // Initialize Elements
  const flyerEl = shadow.getElementById("ghost-flyer");
  const canvasEl = shadow.getElementById("ghost-canvas");
  const bubbleEl = shadow.getElementById("ghost-bubble");
  const actionBar = shadow.getElementById("action-bar");
  const chipsContainer = shadow.getElementById("action-chips");
  const formEl = shadow.getElementById("action-form");
  const inputEl = shadow.getElementById("action-input");
  const voiceBtn = shadow.getElementById("voice-btn");

  const ghostCanvas = new GhostCanvas(canvasEl);
  const actor = new GhostActor(flyerEl, ghostCanvas, bubbleEl);
  const thoughtLog = new ThoughtLog(shadow);

  // Toggle Action Bar on Ghost Click
  flyerEl.addEventListener("click", () => {
    actionBar.classList.toggle("open");
    if (actionBar.classList.contains("open")) {
      inputEl.focus();
    }
  });

  // Track mouse: pupil tracking + evasion physics (only after action completed)
  window.addEventListener("mousemove", (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (window.innerWidth / 2);
    const dy = (e.clientY - cy) / (window.innerHeight / 2);
    ghostCanvas.setLookTarget(dx, dy);

    // Evasion: dodges only if idle after completing user's task
    actor.handleUserMouseMove(e.clientX, e.clientY);
  });

  // Page Context Detection & Dynamic Setup
  const pageContext = detectPageContext(window.location.href, document);
  renderChips(pageContext);
  greetForContext(pageContext);

  async function handleUserCommand(rawText) {
    await routeUserIntent(rawText, actor, thoughtLog, pageContext);
    renderChips(pageContext);
  }

  function renderChips(context) {
    const chips = getContextualChips(context);
    chipsContainer.innerHTML = "";
    chips.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn";
      btn.textContent = c.label;
      btn.addEventListener("click", () => {
        const text = c.action === "toggle_chistyakovskaya" ? "Чистяковская роща" : c.label;
        handleUserCommand(text);
      });
      chipsContainer.appendChild(btn);
    });
  }

  function greetForContext(context) {
    if (context.type === "HOTEL_DETAIL") {
      actor.speak("Вижу отель! Могу выбрать выгодный тариф с завтраком.", 3500);
    } else if (context.type === "SERP") {
      actor.speak("Нашел отели! Готов настроить любые фильтры.", 3500);
    } else {
      actor.speak("Куда отправимся? Назови город или отель.", 3500);
    }
  }

  // Voice controller
  const voice = new VoiceController(
    (transcript) => {
      inputEl.value = transcript;
      handleUserCommand(transcript);
    },
    (listening) => {
      voiceBtn.classList.toggle("active", listening);
      ghostCanvas.setState(listening ? "speaking" : "idle");
    }
  );
  voiceBtn.addEventListener("click", () => voice.toggle());

    // Input form submission
    formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = inputEl.value.trim();
      if (!query) return;
      inputEl.value = "";
      handleUserCommand(query);
    });
  }

  start();
})();
