/**
 * Ostrovok Muse Copilot - Content Script (Manifest V3)
 * Living Flying Ghost Mascot with Real-time Multi-Page DOM Intelligence & Route Guidance.
 */
import { GhostActor } from "./src/ghost-actor.js";
import { GhostCanvas } from "./src/ghost-canvas.js";
import { detectPageContext, getContextualChips } from "./src/page-analyzer.js";
import { RoutePlanner } from "./src/route-planner.js";
import { VoiceController } from "./src/voice.js";

(function initOstrovokCopilot() {
  if (document.getElementById("ostrovok-copilot-shadow-host")) return;

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
    <div class="ostrovok-ghost-flyer" id="ghost-flyer" title="AI Агент Островка">
      <div class="ghost-thought-bubble" id="ghost-bubble">Привет!</div>
      <canvas class="ghost-canvas" id="ghost-canvas" width="60" height="60"></canvas>
    </div>

    <!-- Floating Action Island / Bar -->
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
  const chipsContainer = shadow.getElementById("action-chips");
  const formEl = shadow.getElementById("action-form");
  const inputEl = shadow.getElementById("action-input");
  const voiceBtn = shadow.getElementById("voice-btn");

  const ghostCanvas = new GhostCanvas(canvasEl);
  const actor = new GhostActor(flyerEl, ghostCanvas, bubbleEl);

  // Real route planner connected to genuine Ostrovok booking
  const routePlanner = new RoutePlanner(shadow, async () => {
    const ctx = detectPageContext(window.location.href, document);
    await actor.bookRoomOnOstrovok(ctx.data?.recommendedRoom);
  });

  // Pupil tracking
  window.addEventListener("mousemove", (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (window.innerWidth / 2);
    const dy = (e.clientY - cy) / (window.innerHeight / 2);
    ghostCanvas.setLookTarget(dx, dy);
  });

  // Page Context Detection & Dynamic Setup
  const pageContext = detectPageContext(window.location.href, document);
  renderChips(pageContext);
  greetForContext(pageContext);

  function renderChips(context) {
    const chips = getContextualChips(context);
    chipsContainer.innerHTML = "";
    chips.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn";
      btn.textContent = c.label;
      btn.addEventListener("click", () => handleAction(c.action, c.label));
      chipsContainer.appendChild(btn);
    });
  }

  function greetForContext(context) {
    if (context.type === "HOTEL_DETAIL") {
      const name = context.data.hotelName || "отель";
      actor.speak(`Вижу ${name}! Могу показать маршрут или выбрать выгодный номер.`, 4000);
    } else if (context.type === "SERP") {
      actor.speak("Нашел отели! Готов настроить фильтры и показать топ.", 4000);
    } else {
      actor.speak("Привет! Куда отправимся? Скажи или напиши направление.", 3500);
    }
  }

  // Action Dispatcher
  async function handleAction(actionKey, rawQuery = "") {
    const ctx = detectPageContext(window.location.href, document);

    if (actionKey === "select_best_room" || actionKey === "filter_breakfast_room") {
      if (ctx.type === "HOTEL_DETAIL" && ctx.data.recommendedRoom) {
        await actor.highlightRoomOffer(ctx.data.recommendedRoom);
      } else {
        actor.speak("Сканирую таблицу номеров на странице...", 2500);
      }
    } else if (actionKey === "book_on_ostrovok") {
      const booked = await actor.bookRoomOnOstrovok(ctx.data?.recommendedRoom);
      if (!booked) actor.speak("Ищу кнопку бронирования на странице...", 2500);
    } else if (actionKey === "show_route_planner") {
      routePlanner.show({
        name: ctx.data?.hotelName || "Отель",
        address: ctx.data?.address || "Центральный район",
        city: ctx.data?.city || "",
        distanceSummary: ctx.data?.distanceSummary || "Оптимальная логистика по отзывам",
      });
      actor.speak("Открыл логистику и маршрут поездки!", 2500);
    } else if (actionKey === "toggle_breakfast") {
      const ok = await actor.toggleFilterCheckbox("завтрак");
      if (!ok) actor.speak("Ищу чекбокс 'Завтрак' в панели фильтров...", 2500);
    } else if (actionKey === "toggle_pool") {
      const ok = await actor.toggleFilterCheckbox("бассейн");
      if (!ok) actor.speak("Ищу фильтр бассейна...", 2500);
    } else if (actionKey === "filter_center") {
      const ok = await actor.toggleFilterCheckbox("центр");
      if (!ok) actor.speak("Ищу фильтр близости к центру...", 2500);
    } else if (actionKey === "highlight_top") {
      const card = document.querySelector('[data-testid="serp-hotelcard"], [class*="HotelCard"]');
      if (card) {
        await actor.highlightHotelCard(card, "98% совпадение • Топ по отзывам и цене");
      }
    } else if (actionKey.startsWith("search_")) {
      const city = actionKey === "search_krasnodar" ? "Краснодар" : actionKey === "search_sochi" ? "Сочи" : "Санкт-Петербург";
      const input = document.querySelector('[data-testid="destination-input"], input[placeholder*="Куда"], input[name="destination"]');
      if (input) {
        await actor.flyToElement(input, `Ввожу направление: ${city}`);
        await actor.smoothType(input, city);
        const searchBtn = document.querySelector('[data-testid="search-button"], button[type="submit"]');
        if (searchBtn) {
          await actor.flyToElement(searchBtn, "Запускаю поиск!");
          searchBtn.click();
        }
      }
    } else {
      // General natural language query
      if (/забронир|купи|оформ/i.test(rawQuery)) {
        await actor.bookRoomOnOstrovok(ctx.data?.recommendedRoom);
      } else if (/маршрут|как добраться|транспорт|логистик/i.test(rawQuery)) {
        routePlanner.show({
          name: ctx.data?.hotelName || "Отель",
          address: ctx.data?.address || "Центральный район",
          city: ctx.data?.city || "",
        });
      } else if (/завтрак/i.test(rawQuery)) {
        await actor.toggleFilterCheckbox("завтрак");
      } else if (/бассейн/i.test(rawQuery)) {
        await actor.toggleFilterCheckbox("бассейн");
      } else if (/номер|комнат/i.test(rawQuery)) {
        if (ctx.data?.recommendedRoom) await actor.highlightRoomOffer(ctx.data.recommendedRoom);
      } else {
        actor.speak(`Выполняю: ${rawQuery}`, 3000);
      }
    }
  }

  // Voice controller
  const voice = new VoiceController(
    (transcript) => {
      inputEl.value = transcript;
      handleAction("voice_query", transcript);
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
    handleAction("text_query", query);
  });
})();
