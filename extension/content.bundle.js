// extension/src/ghost-actor.js
class GhostActor {
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
    if (!this.bubble)
      return;
    this.bubble.textContent = text;
    this.bubble.classList.add("visible");
    this.ghost.setState("speaking");
    if (this.bubbleTimeout)
      clearTimeout(this.bubbleTimeout);
    if (durationMs > 0) {
      this.bubbleTimeout = setTimeout(() => {
        this.bubble.classList.remove("visible");
        this.ghost.setState("idle");
      }, durationMs);
    }
  }
  async flyTo(targetX, targetY, speechText = "") {
    if (speechText)
      this.speak(speechText, 3000);
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
    await new Promise((r) => setTimeout(r, 680));
    this.ghost.setTilt(0);
    this.ghost.setState("happy");
    await new Promise((r) => setTimeout(r, 200));
    this.ghost.setState("idle");
  }
  async flyToElement(element, speechText = "") {
    if (!element)
      return;
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise((r) => setTimeout(r, 350));
    }
    const rect = typeof element.getBoundingClientRect === "function" ? element.getBoundingClientRect() : { right: 100, top: 100 };
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
    if (!element || !element.classList)
      return;
    element.classList.add("ostrovok-copilot-targeted");
    setTimeout(() => {
      element.classList.remove("ostrovok-copilot-targeted");
    }, 1200);
  }
  async smoothType(inputEl, text, charDelay = 40) {
    if (!inputEl)
      return;
    if (typeof inputEl.focus === "function")
      inputEl.focus();
    let current = "";
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    for (const char of text) {
      current += char;
      if (setter)
        setter.call(inputEl, current);
      else
        inputEl.value = current;
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
    if (!room || !room.el)
      return;
    await this.flyToElement(room.el, "Выбрал лучший тариф с завтраком!");
    let badge = room.el.querySelector(".ostrovok-copilot-room-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "ostrovok-copilot-room-badge";
      badge.textContent = "Рекомендация Copilot: Выгодный тариф";
      room.el.prepend(badge);
    }
    const bookBtn = room.el.querySelector("button, [class*='Button'], a[href*='book']");
    if (bookBtn)
      this.pulseElement(bookBtn);
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
    if (!cardEl)
      return;
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

// extension/src/ghost-canvas.js
class GhostCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.state = "idle";
    this.targetLook = { x: 0, y: 0 };
    this.currentLook = { x: 0, y: 0 };
    this.tilt = 0;
    this.blinkPhase = "open";
    this.blinkAmount = 0;
    this.nextBlinkTime = Date.now() + 3200;
    this.closedPauseUntil = 0;
    this.animationId = null;
    this.setupDPI();
    this.startLoop();
  }
  setupDPI() {
    const dpr = window.devicePixelRatio || 2;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 64;
    const h = rect.height || 64;
    this.width = w;
    this.height = h;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
  }
  setLookTarget(xRatio, yRatio) {
    this.targetLook.x = Math.max(-1, Math.min(1, xRatio));
    this.targetLook.y = Math.max(-1, Math.min(1, yRatio));
  }
  setTilt(radians) {
    this.tilt = Math.max(-0.4, Math.min(0.4, radians));
  }
  setState(newState) {
    this.state = newState;
  }
  startLoop() {
    const render = () => {
      this.update();
      this.draw();
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }
  destroy() {
    if (this.animationId)
      cancelAnimationFrame(this.animationId);
  }
  update() {
    const now = Date.now();
    this.currentLook.x += (this.targetLook.x - this.currentLook.x) * 0.12;
    this.currentLook.y += (this.targetLook.y - this.currentLook.y) * 0.12;
    if (this.blinkPhase === "open" && now > this.nextBlinkTime) {
      this.blinkPhase = "closing";
    }
    if (this.blinkPhase === "closing") {
      this.blinkAmount += 0.035;
      if (this.blinkAmount >= 1) {
        this.blinkAmount = 1;
        this.blinkPhase = "closed";
        this.closedPauseUntil = now + 85;
      }
    } else if (this.blinkPhase === "closed" && now > this.closedPauseUntil) {
      this.blinkPhase = "opening";
    } else if (this.blinkPhase === "opening") {
      this.blinkAmount -= 0.04;
      if (this.blinkAmount <= 0) {
        this.blinkAmount = 0;
        this.blinkPhase = "open";
        this.nextBlinkTime = now + 3500 + Math.random() * 2500;
      }
    }
  }
  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const now = Date.now();
    ctx.clearRect(0, 0, w, h);
    const isFlying = this.state === "flying";
    const floatSpeed = isFlying ? 180 : 360;
    const floatAmp = isFlying ? 4 : 2.6;
    const floatOffset = Math.sin(now / floatSpeed) * floatAmp;
    const cx = w / 2;
    const cy = h / 2 + floatOffset;
    const bodyW = w * 0.74;
    const bodyH = h * 0.78;
    const r = bodyW / 2;
    const topY = cy - bodyH / 2;
    const bottomY = cy + bodyH / 2;
    const leftX = cx - r;
    const rightX = cx + r;
    ctx.save();
    if (this.tilt !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(this.tilt);
      ctx.translate(-cx, -cy);
    }
    ctx.beginPath();
    ctx.arc(cx, topY + r, r, Math.PI, 0, false);
    ctx.lineTo(rightX, bottomY - 6);
    const waveW = bodyW / 3;
    const waveFreq = isFlying ? 140 : 220;
    const waveH = 4.5 + Math.sin(now / waveFreq) * 1.8;
    ctx.quadraticCurveTo(rightX - waveW * 0.5, bottomY + waveH, rightX - waveW, bottomY - 4);
    ctx.quadraticCurveTo(cx, bottomY + waveH, cx - waveW * 0.5, bottomY - 4);
    ctx.quadraticCurveTo(leftX + waveW * 0.5, bottomY + waveH, leftX, bottomY - 6);
    ctx.lineTo(leftX, topY + r);
    ctx.closePath();
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = "#1652F0";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 140, 160, 0.45)";
    const blushR = bodyW * 0.12;
    const blushY = topY + r + 13;
    ctx.beginPath();
    ctx.ellipse(cx - bodyW * 0.28, blushY, blushR, blushR * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + bodyW * 0.28, blushY, blushR, blushR * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawEyes(ctx, cx, topY + r + 4, bodyW);
    ctx.restore();
  }
  drawEyes(ctx, cx, eyeCenterY, bodyW) {
    const eyeSpacing = bodyW * 0.24;
    const leftEyeX = cx - eyeSpacing;
    const rightEyeX = cx + eyeSpacing;
    const maxEyeR = 3.8;
    const pupilOffsetX = this.currentLook.x * 2.2;
    const pupilOffsetY = this.currentLook.y * 1.8;
    if (this.state === "happy") {
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#111827";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeCenterY, maxEyeR, Math.PI * 1.1, Math.PI * 1.9, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeCenterY, maxEyeR, Math.PI * 1.1, Math.PI * 1.9, false);
      ctx.stroke();
      return;
    }
    const currentHeightR = Math.max(0.4, maxEyeR * (1 - this.blinkAmount));
    [leftEyeX, rightEyeX].forEach((eyeX) => {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = "#111827";
      ctx.ellipse(eyeX + pupilOffsetX, eyeCenterY + pupilOffsetY, maxEyeR, currentHeightR, 0, 0, Math.PI * 2);
      ctx.fill();
      if (this.blinkAmount < 0.45) {
        ctx.beginPath();
        ctx.fillStyle = "#FFFFFF";
        ctx.arc(eyeX + pupilOffsetX - 1.2, eyeCenterY + pupilOffsetY - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }
}

// extension/src/page-analyzer.js
function detectPageContext(url = window.location.href, doc = document) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const search = urlObj.search;
  if (pathname.includes("/hotel/") && (pathname.includes("/mid") || doc.querySelector('[class*="Room"], [data-testid*="room"], [class*="rates"]'))) {
    return {
      type: "HOTEL_DETAIL",
      data: analyzeHotelDetailPage(doc, urlObj)
    };
  }
  if (search.includes("search=yes") || pathname.includes("/hotel/") && !pathname.includes("/mid")) {
    return {
      type: "SERP",
      data: analyzeSerpPage(doc, urlObj)
    };
  }
  const destInput = doc.querySelector('[data-testid="destination-input"], input[placeholder*="Куда"], input[name="destination"]');
  if (pathname === "/" || pathname === "" || destInput) {
    return {
      type: "HOME",
      data: analyzeHomePage(doc, urlObj)
    };
  }
  return {
    type: "GENERIC",
    data: { url: urlObj.href }
  };
}
function analyzeHotelDetailPage(doc, urlObj) {
  const nameEl = doc.querySelector('h1, [data-testid*="hotel-name"], [class*="HotelHeader_name"]');
  const hotelName = nameEl?.textContent?.trim() || "Отель";
  const ratingEl = doc.querySelector('[data-testid*="rating"], [class*="Rating_value"]');
  const rating = ratingEl?.textContent?.trim() || "8.8";
  const addrEl = doc.querySelector('[class*="Address"], [data-testid*="address"], [class*="HotelHeader_address"]');
  const address = addrEl?.textContent?.trim() || "";
  const distEl = doc.querySelector('[class*="Distance"], [data-testid*="distance"], [class*="Geo_root"]');
  const distanceSummary = distEl?.textContent?.trim() || "";
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const city = pathParts.length > 2 ? pathParts[2] : "";
  const roomRows = Array.from(doc.querySelectorAll('[class*="Room_root"], [data-testid*="room-row"], tr[class*="rate"], div[class*="RateCard"]'));
  const rooms = roomRows.slice(0, 5).map((row, idx) => {
    const title = row.querySelector('[class*="name"], [class*="Title"], h3, h4')?.textContent?.trim() || `Номер ${idx + 1}`;
    const price = row.querySelector('[class*="price"], [class*="Price"]')?.textContent?.trim() || "";
    const hasBreakfast = /завтрак/i.test(row.textContent || "");
    const freeCancel = /бесплатн.*отмен/i.test(row.textContent || "");
    return { idx, title, price, hasBreakfast, freeCancel, el: row };
  });
  let recommendedRoom = rooms.find((r) => r.hasBreakfast) || rooms[0] || null;
  return {
    hotelName,
    rating,
    address,
    distanceSummary,
    city,
    roomsCount: rooms.length,
    rooms,
    recommendedRoom
  };
}
function analyzeSerpPage(doc, urlObj) {
  const cards = Array.from(doc.querySelectorAll('[data-testid="serp-hotelcard"], [class*="HotelCard"], [class*="zen-hotelcard"]'));
  const hotelCount = cards.length;
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const cityGuess = pathParts.length > 2 ? pathParts[2] : "городе";
  const filterLabels = Array.from(doc.querySelectorAll("label, [role='checkbox'], [class*='FilterCheckbox']"));
  const hasBreakfastFilter = filterLabels.some((l) => /завтрак/i.test(l.textContent || ""));
  const hasPoolFilter = filterLabels.some((l) => /бассейн/i.test(l.textContent || ""));
  const hasParkingFilter = filterLabels.some((l) => /парковк/i.test(l.textContent || ""));
  const hasPetFilter = filterLabels.some((l) => /питомц|животн/i.test(l.textContent || ""));
  return {
    city: cityGuess,
    hotelCount,
    hasBreakfastFilter,
    hasPoolFilter,
    hasParkingFilter,
    hasPetFilter
  };
}
function analyzeHomePage(doc, urlObj) {
  const destInput = doc.querySelector('[data-testid="destination-input"], input[placeholder*="Куда"], input[name="destination"]');
  const searchBtn = doc.querySelector('[data-testid="search-button"], button[type="submit"]');
  return {
    hasDestinationInput: Boolean(destInput),
    hasSearchButton: Boolean(searchBtn)
  };
}
function getContextualChips(context) {
  switch (context.type) {
    case "HOTEL_DETAIL":
      return [
        { label: "Выбрать лучший номер", action: "select_best_room" },
        { label: "Забронировать на Островке", action: "book_on_ostrovok" },
        { label: "Маршрут и логистика", action: "show_route_planner" }
      ];
    case "SERP":
      return [
        { label: "Включить завтрак", action: "toggle_breakfast" },
        { label: "С бассейном", action: "toggle_pool" },
        { label: "Ближе к центру", action: "filter_center" },
        { label: "Топ по отзывам", action: "highlight_top" }
      ];
    case "HOME":
    default:
      return [
        { label: "Краснодар 24-25 окт", action: "search_krasnodar" },
        { label: "Сочи с бассейном", action: "search_sochi" },
        { label: "Питер командировка", action: "search_spb" }
      ];
  }
}

// extension/src/route-planner.js
class RoutePlanner {
  constructor(shadowRoot, onProceedToBooking) {
    this.root = shadowRoot;
    this.onProceedToBooking = onProceedToBooking;
    this.panelEl = null;
    this.createPanel();
  }
  createPanel() {
    this.panelEl = document.createElement("div");
    this.panelEl.className = "ostrovok-route-panel";
    this.panelEl.innerHTML = `
      <div class="route-panel-header">
        <div class="route-header-title">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span>Маршрут и логистика поездки</span>
        </div>
        <button type="button" class="route-close-btn" aria-label="Закрыть">&times;</button>
      </div>

      <div class="route-hotel-info">
        <div class="route-hotel-name" id="route-hotel-name">Отель</div>
        <div class="route-hotel-address" id="route-hotel-address">Адрес загружается...</div>
      </div>

      <div class="route-legs" id="route-legs">
        <!-- Rendered dynamically -->
      </div>

      <div class="route-footer">
        <div class="route-summary" id="route-summary">Оптимальная логистика по отзывам гостей</div>
        <button type="button" class="btn-proceed-booking" id="btn-proceed-booking">
          <span>Перейти к бронированию на Островке</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    `;
    this.panelEl.querySelector(".route-close-btn").addEventListener("click", () => {
      this.hide();
    });
    this.panelEl.querySelector("#btn-proceed-booking").addEventListener("click", () => {
      this.hide();
      if (typeof this.onProceedToBooking === "function") {
        this.onProceedToBooking();
      }
    });
    this.root.appendChild(this.panelEl);
  }
  show(hotelInfo = {}) {
    const nameEl = this.panelEl.querySelector("#route-hotel-name");
    const addrEl = this.panelEl.querySelector("#route-hotel-address");
    const legsContainer = this.panelEl.querySelector("#route-legs");
    const summaryEl = this.panelEl.querySelector("#route-summary");
    if (nameEl)
      nameEl.textContent = hotelInfo.name || "Выбранный отель";
    if (addrEl)
      addrEl.textContent = hotelInfo.address || "Центральный район";
    const legs = this.calculateRouteLegs(hotelInfo);
    legsContainer.innerHTML = legs.map((leg) => `
      <div class="route-leg-item">
        <div class="leg-icon-col">
          <div class="leg-icon-dot"></div>
          <div class="leg-line"></div>
        </div>
        <div class="leg-content">
          <div class="leg-title">${leg.title}</div>
          <div class="leg-desc">${leg.description}</div>
        </div>
        <div class="leg-time">${leg.duration}</div>
      </div>
    `).join("");
    if (summaryEl && hotelInfo.distanceSummary) {
      summaryEl.textContent = hotelInfo.distanceSummary;
    }
    this.panelEl.classList.add("visible");
  }
  hide() {
    this.panelEl.classList.remove("visible");
  }
  calculateRouteLegs(hotelInfo) {
    const city = (hotelInfo.city || "").toLowerCase();
    const isSochi = city.includes("сочи") || city.includes("полян");
    const isSpb = city.includes("питер") || city.includes("санкт");
    if (isSochi) {
      return [
        {
          title: "Аэропорт Сочи (AER) → Отель",
          description: "Скоростная «Ласточка» или такси по совмещенной трассе",
          duration: "40 мин"
        },
        {
          title: "Отель → Подъемники / Горная карусель",
          description: "Бесплатный шаттл от отеля каждые 15 минут",
          duration: "7 мин"
        },
        {
          title: "Пешая доступность",
          description: "Прокат снаряжения, рестораны и супермаркет в 200 м",
          duration: "3 мин"
        }
      ];
    }
    if (isSpb) {
      return [
        {
          title: "Московский вокзал → Отель",
          description: "Прямой маршрут по Невскому проспекту / линия метро 1",
          duration: "12 мин"
        },
        {
          title: "Отель → Эрмитаж и Дворцовая площадь",
          description: "Пешая прогулка по исторической набережной",
          duration: "15 мин"
        },
        {
          title: "Ближайшая станция метро",
          description: "Удобный доступ к центральным пересадкам",
          duration: "4 мин"
        }
      ];
    }
    return [
      {
        title: "Транспортный узел (Аэропорт / ЖД) → Отель",
        description: "Оптимальный маршрут на экспрессе или городском такси",
        duration: "30-45 мин"
      },
      {
        title: "Отель → Исторический / Деловой центр",
        description: "Удобный выезд на ключевые магистрали",
        duration: "10-15 мин"
      },
      {
        title: "Инфраструктура рядом",
        description: "Остановки общественного транспорта, кафе и магазины",
        duration: "2-5 мин"
      }
    ];
  }
}

// extension/src/voice.js
class VoiceController {
  constructor(onResultCallback, onStateChangeCallback) {
    this.onResult = onResultCallback;
    this.onStateChange = onStateChangeCallback;
    this.recognition = null;
    this.isListening = false;
    this.init();
  }
  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.supported = false;
      return;
    }
    this.supported = true;
    this.recognition = new SpeechRecognition;
    this.recognition.lang = "ru-RU";
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStateChange)
        this.onStateChange(true);
    };
    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onStateChange)
        this.onStateChange(false);
    };
    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (this.onResult && transcript) {
        this.onResult(transcript);
      }
    };
    this.recognition.onerror = () => {
      this.isListening = false;
      if (this.onStateChange)
        this.onStateChange(false);
    };
  }
  toggle() {
    if (!this.supported)
      return;
    if (this.isListening) {
      this.recognition.stop();
    } else {
      try {
        this.recognition.start();
      } catch {}
    }
  }
}

// extension/content.js
(function initOstrovokCopilot() {
  if (document.getElementById("ostrovok-copilot-shadow-host"))
    return;
  const host = document.createElement("div");
  host.id = "ostrovok-copilot-shadow-host";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("styles.css");
  shadow.appendChild(styleLink);
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
  const flyerEl = shadow.getElementById("ghost-flyer");
  const canvasEl = shadow.getElementById("ghost-canvas");
  const bubbleEl = shadow.getElementById("ghost-bubble");
  const chipsContainer = shadow.getElementById("action-chips");
  const formEl = shadow.getElementById("action-form");
  const inputEl = shadow.getElementById("action-input");
  const voiceBtn = shadow.getElementById("voice-btn");
  const ghostCanvas = new GhostCanvas(canvasEl);
  const actor = new GhostActor(flyerEl, ghostCanvas, bubbleEl);
  const routePlanner = new RoutePlanner(shadow, async () => {
    const ctx = detectPageContext(window.location.href, document);
    await actor.bookRoomOnOstrovok(ctx.data?.recommendedRoom);
  });
  window.addEventListener("mousemove", (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (window.innerWidth / 2);
    const dy = (e.clientY - cy) / (window.innerHeight / 2);
    ghostCanvas.setLookTarget(dx, dy);
  });
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
      if (!booked)
        actor.speak("Ищу кнопку бронирования на странице...", 2500);
    } else if (actionKey === "show_route_planner") {
      routePlanner.show({
        name: ctx.data?.hotelName || "Отель",
        address: ctx.data?.address || "Центральный район",
        city: ctx.data?.city || "",
        distanceSummary: ctx.data?.distanceSummary || "Оптимальная логистика по отзывам"
      });
      actor.speak("Открыл логистику и маршрут поездки!", 2500);
    } else if (actionKey === "toggle_breakfast") {
      const ok = await actor.toggleFilterCheckbox("завтрак");
      if (!ok)
        actor.speak("Ищу чекбокс 'Завтрак' в панели фильтров...", 2500);
    } else if (actionKey === "toggle_pool") {
      const ok = await actor.toggleFilterCheckbox("бассейн");
      if (!ok)
        actor.speak("Ищу фильтр бассейна...", 2500);
    } else if (actionKey === "filter_center") {
      const ok = await actor.toggleFilterCheckbox("центр");
      if (!ok)
        actor.speak("Ищу фильтр близости к центру...", 2500);
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
      if (/забронир|купи|оформ/i.test(rawQuery)) {
        await actor.bookRoomOnOstrovok(ctx.data?.recommendedRoom);
      } else if (/маршрут|как добраться|транспорт|логистик/i.test(rawQuery)) {
        routePlanner.show({
          name: ctx.data?.hotelName || "Отель",
          address: ctx.data?.address || "Центральный район",
          city: ctx.data?.city || ""
        });
      } else if (/завтрак/i.test(rawQuery)) {
        await actor.toggleFilterCheckbox("завтрак");
      } else if (/бассейн/i.test(rawQuery)) {
        await actor.toggleFilterCheckbox("бассейн");
      } else if (/номер|комнат/i.test(rawQuery)) {
        if (ctx.data?.recommendedRoom)
          await actor.highlightRoomOffer(ctx.data.recommendedRoom);
      } else {
        actor.speak(`Выполняю: ${rawQuery}`, 3000);
      }
    }
  }
  const voice = new VoiceController((transcript) => {
    inputEl.value = transcript;
    handleAction("voice_query", transcript);
  }, (listening) => {
    voiceBtn.classList.toggle("active", listening);
    ghostCanvas.setState(listening ? "speaking" : "idle");
  });
  voiceBtn.addEventListener("click", () => voice.toggle());
  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = inputEl.value.trim();
    if (!query)
      return;
    inputEl.value = "";
    handleAction("text_query", query);
  });
})();
