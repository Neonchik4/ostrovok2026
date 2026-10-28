/**
 * Ostrovok Muse Copilot Runtime
 * Автономный встраиваемый агент для управления живым сайтом Островка.
 * Включает 3 интерактивных маскота, Spotlight Cursor и DOM-автоматизацию.
 */

(function () {
  if (window.__OSTROVOK_COPILOT_INITIALIZED__) return;
  window.__OSTROVOK_COPILOT_INITIALIZED__ = true;

  // Конфигурация состояния
  const state = {
    activeMascot: "island", // island | orb | beacon
    activePersona: "bro",   // bro | assistant | luxury
    isListening: false,
    isExecuting: false,
    speechText: "Привет! Куда рванем? Назови город или отель, а я настрою фильтры и найду лучшее.",
    minimized: false,
  };

  // Создаем изолированный контейнер для стилей и элементов интерфейса
  const host = document.createElement("div");
  host.id = "ostrovok-copilot-host";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Вставляем стили
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    
    :host {
      --primary-bro: #2DD4BF;
      --primary-asst: #3B82F6;
      --primary-lux: #F59E0B;
      --bg-dock: rgba(22, 24, 29, 0.95);
      --border-dock: rgba(255, 255, 255, 0.12);
      --text-main: #F4F4F6;
      --text-muted: #8E92A0;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999999;
      pointer-events: none;
    }

    .copilot-container {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
      width: 380px;
      max-width: calc(100vw - 48px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .copilot-container.minimized .copilot-card {
      display: none;
    }

    /* Маскот и баббл */
    .mascot-row {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      width: 100%;
    }

    .speech-bubble {
      flex: 1;
      background: var(--bg-dock);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border-dock);
      border-radius: 16px 16px 4px 16px;
      padding: 12px 16px;
      color: var(--text-main);
      font-size: 13.5px;
      line-height: 1.45;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
      animation: fadeIn 0.3s ease;
      position: relative;
    }

    .mascot-avatar-wrapper {
      width: 68px;
      height: 68px;
      flex-shrink: 0;
      background: var(--bg-dock);
      border: 1px solid var(--border-dock);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    /* Главная карточка */
    .copilot-card {
      width: 100%;
      background: var(--bg-dock);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-dock);
      border-radius: 20px;
      padding: 16px;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .controls-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      padding-bottom: 10px;
    }

    .pills-group {
      display: flex;
      gap: 4px;
      background: rgba(0,0,0,0.3);
      padding: 3px;
      border-radius: 10px;
    }

    .pill-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 500;
      padding: 4px 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .pill-btn.active {
      background: rgba(255,255,255,0.15);
      color: var(--text-main);
    }

    .pill-btn.persona-bro.active { color: var(--primary-bro); }
    .pill-btn.persona-asst.active { color: var(--primary-asst); }
    .pill-btn.persona-lux.active { color: var(--primary-lux); }

    /* Поле ввода */
    .input-wrapper {
      display: flex;
      gap: 8px;
      align-items: center;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 4px 6px 4px 12px;
    }

    .input-wrapper:focus-within {
      border-color: rgba(255,255,255,0.25);
    }

    .copilot-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-main);
      font-size: 13px;
    }

    .copilot-input::placeholder {
      color: var(--text-muted);
    }

    .action-btn {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      border: none;
      background: rgba(255,255,255,0.08);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .action-btn:hover { background: rgba(255,255,255,0.15); }
    .action-btn.active { background: #ef4444; color: white; }
    .action-btn.send-btn { background: var(--primary-bro); color: #000; font-weight: bold; }
    .action-btn.send-btn.persona-asst { background: var(--primary-asst); color: #fff; }
    .action-btn.send-btn.persona-lux { background: var(--primary-lux); color: #000; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  shadow.appendChild(styleEl);

  // Контейнер элементов
  const container = document.createElement("div");
  container.className = "copilot-container";
  container.innerHTML = `
    <div class="mascot-row">
      <div class="speech-bubble" id="speech-bubble">
        ${state.speechText}
      </div>
      <div class="mascot-avatar-wrapper" id="mascot-avatar-wrapper" title="Нажмите, чтобы свернуть/развернуть">
        <canvas id="mascot-canvas" width="68" height="68"></canvas>
      </div>
    </div>

    <div class="copilot-card">
      <div class="controls-row">
        <!-- Выбор персоны -->
        <div class="pills-group" id="persona-group">
          <button class="pill-btn persona-bro active" data-persona="bro">Бро</button>
          <button class="pill-btn persona-asst" data-persona="assistant">Бизнес</button>
          <button class="pill-btn persona-lux" data-persona="luxury">Люкс</button>
        </div>

        <!-- Выбор маскота -->
        <div class="pills-group" id="mascot-group">
          <button class="pill-btn active" data-mascot="island">Островок</button>
          <button class="pill-btn" data-mascot="orb">Сфера</button>
          <button class="pill-btn" data-mascot="beacon">Маяк</button>
        </div>
      </div>

      <div class="input-wrapper">
        <input class="copilot-input" id="copilot-input" placeholder="Куда рванем? Например: Сочи с бассейном" />
        <button class="action-btn" id="mic-btn" title="Голосовой ввод">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
        </button>
        <button class="action-btn send-btn persona-bro" id="send-btn" title="Отправить">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
        </button>
      </div>
    </div>
  `;
  shadow.appendChild(container);

  // Создаем внешний световой Spotlight Cursor в основном документе
  const spotlight = document.createElement("div");
  spotlight.id = "ostrovok-spotlight-cursor";
  spotlight.style.cssText = `
    position: fixed;
    top: -100px;
    left: -100px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(45,212,191,0.9) 0%, rgba(45,212,191,0.2) 70%, transparent 100%);
    box-shadow: 0 0 20px rgba(45,212,191,0.8), 0 0 40px rgba(45,212,191,0.4);
    pointer-events: none;
    z-index: 10000000;
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
    opacity: 0;
    transform: translate(-50%, -50%);
  `;
  document.body.appendChild(spotlight);

  // Рендер 3 маскотов на Canvas
  const canvas = shadow.getElementById("mascot-canvas");
  const ctx = canvas.getContext("2d");
  let animFrameId;
  let tick = 0;

  function renderMascot() {
    tick += 0.05;
    ctx.clearRect(0, 0, 68, 68);

    const personaColor = state.activePersona === "luxury" ? "#F59E0B" : (state.activePersona === "assistant" ? "#3B82F6" : "#2DD4BF");

    if (state.activeMascot === "island") {
      // 1. «Живой Островок»
      const bounce = Math.sin(tick) * 3;
      
      // Основа островка
      ctx.beginPath();
      ctx.ellipse(34, 46 + bounce, 24, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#E0A96D";
      ctx.fill();

      // Зеленая шапка
      ctx.beginPath();
      ctx.ellipse(34, 38 + bounce, 20, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = personaColor;
      ctx.fill();

      // Глазки
      const blink = Math.sin(tick * 0.5) > 0.95 ? 1 : 4;
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(28, 36 + bounce, 3, blink);
      ctx.fillRect(37, 36 + bounce, 3, blink);

    } else if (state.activeMascot === "orb") {
      // 2. «Биоморфная Сфера»
      const r = 20 + Math.sin(tick * 1.5) * 2;
      const grad = ctx.createRadialGradient(34, 34, 4, 34, 34, 26);
      grad.addColorStop(0, "#FFFFFF");
      grad.addColorStop(0.5, personaColor);
      grad.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(34, 34, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Орбитальные искорки
      const sparkX = 34 + Math.cos(tick * 2) * 24;
      const sparkY = 34 + Math.sin(tick * 2) * 24;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();

    } else if (state.activeMascot === "beacon") {
      // 3. «Тревел-Маяк»
      // Корпус
      ctx.beginPath();
      ctx.moveTo(28, 54);
      ctx.lineTo(31, 22);
      ctx.lineTo(37, 22);
      ctx.lineTo(40, 54);
      ctx.closePath();
      ctx.fillStyle = "#94A3B8";
      ctx.fill();

      // Огонь маяка
      ctx.beginPath();
      ctx.arc(34, 20, 6, 0, Math.PI * 2);
      ctx.fillStyle = personaColor;
      ctx.fill();

      // Луч света
      const beamAngle = tick % (Math.PI * 2);
      const bx = 34 + Math.cos(beamAngle) * 28;
      const by = 20 + Math.sin(beamAngle) * 16;
      ctx.beginPath();
      ctx.moveTo(34, 20);
      ctx.lineTo(bx - 6, by);
      ctx.lineTo(bx + 6, by);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fill();
    }

    animFrameId = requestAnimationFrame(renderMascot);
  }
  renderMascot();

  // Обработчики интерфейса
  const inputEl = shadow.getElementById("copilot-input");
  const sendBtn = shadow.getElementById("send-btn");
  const micBtn = shadow.getElementById("mic-btn");
  const speechBubble = shadow.getElementById("speech-bubble");
  const avatarWrapper = shadow.getElementById("mascot-avatar-wrapper");

  // Переключение маскота
  shadow.getElementById("mascot-group").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    shadow.querySelectorAll("#mascot-group .pill-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.activeMascot = btn.dataset.mascot;
  });

  // Переключение персоны
  shadow.getElementById("persona-group").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    shadow.querySelectorAll("#persona-group .pill-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.activePersona = btn.dataset.persona;

    sendBtn.className = `action-btn send-btn persona-${state.activePersona === "assistant" ? "asst" : (state.activePersona === "luxury" ? "lux" : "bro")}`;
    const pColor = state.activePersona === "luxury" ? "rgba(245,158,11,0.9)" : (state.activePersona === "assistant" ? "rgba(59,130,246,0.9)" : "rgba(45,212,191,0.9)");
    spotlight.style.background = `radial-gradient(circle, ${pColor} 0%, transparent 70%)`;
  });

  // Свернуть / Развернуть
  avatarWrapper.addEventListener("click", () => {
    state.minimized = !state.minimized;
    container.classList.toggle("minimized", state.minimized);
  });

  // Функция для анимации движения Spotlight Cursor к элементу
  async function moveCursorTo(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    spotlight.style.opacity = "1";
    spotlight.style.left = `${x}px`;
    spotlight.style.top = `${y}px`;

    await new Promise((r) => setTimeout(r, 650));
  }

  // DOM Automation Engine
  async function executeSteps(steps) {
    state.isExecuting = true;

    for (const step of steps) {
      if (step.action === "set_destination") {
        const input = document.querySelector("input[placeholder*='Куда' i], [data-testid='search-input'], input[name='destination'], input[type='text']");
        if (input) {
          await moveCursorTo(input);
          input.focus();
          input.value = step.value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          await new Promise((r) => setTimeout(r, 400));
        }
      } else if (step.action === "toggle_filter") {
        // Ищем чекбокс по тексту или значению
        const checkboxes = Array.from(document.querySelectorAll("input[type='checkbox']"));
        const targetCb = checkboxes.find((cb) => {
          const parentText = (cb.parentElement?.textContent || "").toLowerCase();
          return parentText.includes("бассейн") || parentText.includes("спа") || parentText.includes("пляж");
        }) || checkboxes[0];

        if (targetCb) {
          await moveCursorTo(targetCb);
          targetCb.click();
          await new Promise((r) => setTimeout(r, 400));
        }
      } else if (step.action === "scroll_to_hotel") {
        const hotelCard = document.querySelector("article, [data-testid='hotel-card'], .hotel-card, [class*='HotelCard'], [class*='hotel']");
        if (hotelCard) {
          await moveCursorTo(hotelCard);
          hotelCard.scrollIntoView({ behavior: "smooth", block: "center" });
          await new Promise((r) => setTimeout(r, 500));
        }
      } else if (step.action === "highlight_hotel") {
        const hotelCard = document.querySelector("article, [data-testid='hotel-card'], .hotel-card, [class*='HotelCard'], [class*='hotel']");
        if (hotelCard) {
          hotelCard.style.outline = "3px solid #2DD4BF";
          hotelCard.style.boxShadow = "0 0 30px rgba(45,212,191,0.4)";
          hotelCard.style.transition = "all 0.4s ease";
        }
      }
    }

    spotlight.style.opacity = "0";
    state.isExecuting = false;
  }

  // Отправка запроса на бэкенд
  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text || state.isExecuting) return;
    inputEl.value = "";

    speechBubble.textContent = "Анализирую запрос и подбираю отели...";

    try {
      const resp = await fetch("/api/live/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          persona: state.activePersona,
          current_url: window.location.href,
        }),
      });

      if (!resp.ok) throw new Error("HTTP error " + resp.status);
      const data = await resp.json();

      speechBubble.textContent = data.speech || "Вот подходящие варианты!";
      if (data.steps && data.steps.length) {
        await executeSteps(data.steps);
      }
    } catch (err) {
      speechBubble.textContent = "Настроил выдачу под ваши параметры поездки!";
      await executeSteps([
        { action: "set_destination", value: text },
        { action: "scroll_to_hotel", value: 0 },
      ]);
    }
  }

  sendBtn.addEventListener("click", handleSend);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  // Голосовой ввод через Web Speech API
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = false;

    recognition.onstart = () => {
      state.isListening = true;
      micBtn.classList.add("active");
      speechBubble.textContent = "Слушаю вас! Назовите город или пожелания...";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      inputEl.value = transcript;
      handleSend();
    };

    recognition.onend = () => {
      state.isListening = false;
      micBtn.classList.remove("active");
    };

    micBtn.addEventListener("click", () => {
      if (state.isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    });
  } else {
    micBtn.style.display = "none";
  }
})();
