// extension/src/semantic-dom.js
function cleanQuery(rawText) {
  return rawText.toLowerCase().replace(/^(найди|поищи|включи|поставь|выбери|добавь|покажи|отметь)\s+/i, "").replace(/\s+(и\s+включи|и\s+выбери|и\s+найди|фильтр|чекбокс|галочку)$/i, "").trim();
}
function findFilterElement(targetName, doc = document) {
  const query = cleanQuery(targetName);
  if (!query)
    return null;
  let match = searchVisibleLabels(query, doc);
  if (match)
    return match;
  const spoilerButtons = Array.from(doc.querySelectorAll('button[class*="SpoilerButton"], button[class*="showMore"], button')).filter((b) => /показать еще/i.test(b.textContent || ""));
  for (const btn of spoilerButtons) {
    try {
      btn.click();
    } catch {}
  }
  return searchVisibleLabels(query, doc);
}
function searchVisibleLabels(query, doc = document) {
  const candidateLabels = Array.from(doc.querySelectorAll('.FiltersListItem_root__UH0W8, [class*="FiltersListItem"], label, [role="checkbox"]'));
  for (const item of candidateLabels) {
    const text = (item.textContent || "").toLowerCase().trim();
    if (text.includes(query)) {
      const input = item.querySelector("input[type='checkbox']") || (item.tagName === "INPUT" ? item : null);
      return { container: item, input, text };
    }
  }
  const tokens = query.split(/\s+/).filter((t) => t.length > 2);
  for (const item of candidateLabels) {
    const text = (item.textContent || "").toLowerCase();
    if (tokens.every((t) => text.includes(t))) {
      const input = item.querySelector("input[type='checkbox']") || (item.tagName === "INPUT" ? item : null);
      return { container: item, input, text };
    }
  }
  return null;
}
function setCheckboxSemanticState(inputEl, containerEl, desiredState = true) {
  if (!inputEl) {
    if (containerEl)
      containerEl.click();
    return { changed: true, alreadyInState: false };
  }
  const isChecked = Boolean(inputEl.checked);
  if (isChecked === desiredState) {
    return { changed: false, alreadyInState: true };
  }
  const clickable = containerEl?.querySelector("label") || containerEl || inputEl;
  clickable.click();
  return { changed: true, alreadyInState: false };
}
function setPriceLimit(maxPrice, doc = document) {
  const priceInput = doc.querySelector('#price_to, input[name="price_to"], input[id*="price_to"]');
  if (!priceInput)
    return false;
  priceInput.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const formatted = `${maxPrice} ₽`;
  if (setter)
    setter.call(priceInput, formatted);
  else
    priceInput.value = formatted;
  priceInput.dispatchEvent(new Event("input", { bubbles: true }));
  priceInput.dispatchEvent(new Event("change", { bubbles: true }));
  priceInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const thumb = doc.querySelectorAll('[role="slider"]')[1];
  if (thumb)
    thumb.setAttribute("aria-valuenow", String(maxPrice));
  return true;
}
function setDistanceLimit(maxKm, doc = document) {
  const distInput = doc.querySelector('#distance_filter\\.field, input[name*="distance"]');
  if (!distInput)
    return false;
  distInput.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const formatted = `${maxKm} км`;
  if (setter)
    setter.call(distInput, formatted);
  else
    distInput.value = formatted;
  distInput.dispatchEvent(new Event("input", { bubbles: true }));
  distInput.dispatchEvent(new Event("change", { bubbles: true }));
  distInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const thumb = doc.querySelector('.DistanceFilter_root__gph2_ ~ .Slider_track__tp_xu [role="slider"]');
  if (thumb)
    thumb.setAttribute("aria-valuenow", String(maxKm));
  return true;
}
function setSortOption(sortHint, doc = document) {
  const container = doc.querySelector('[data-testid="sort-filter-field-container"], #sort-filter-select');
  if (!container)
    return false;
  const clickable = container.closest("label") || container;
  clickable.click();
  const options = Array.from(doc.querySelectorAll('[class*="option"], [role="option"], li'));
  const targetOption = options.find((opt) => new RegExp(sortHint, "i").test(opt.textContent || ""));
  if (targetOption) {
    targetOption.click();
    return true;
  }
  return false;
}

// extension/src/ghost-actor.js
function shortenText(text, maxChars = 50) {
  if (!text)
    return "";
  const cleaned = text.trim();
  if (cleaned.length <= maxChars)
    return cleaned;
  return cleaned.substring(0, maxChars - 3) + "...";
}

class GhostActor {
  constructor(flyerElement, ghostCanvas, thoughtBubbleElement) {
    this.flyer = flyerElement;
    this.ghost = ghostCanvas;
    this.bubble = thoughtBubbleElement;
    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;
    this.homeCoords = { x: winW - 90, y: winH - 90 };
    this.currentCoords = { x: winW - 90, y: winH - 90 };
    this.isDodging = false;
    this.isExecuting = false;
  }
  speak(text, durationMs = 3200) {
    if (!this.bubble)
      return;
    const short = shortenText(text, 65);
    this.bubble.textContent = short;
    this.bubble.classList.remove("align-center", "align-left");
    if (this.currentCoords.x < 260) {
      this.bubble.classList.add("align-left");
    } else if (this.currentCoords.x < window.innerWidth - 300) {
      this.bubble.classList.add("align-center");
    }
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
      this.speak(speechText, 2800);
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
    this.homeCoords = { x: winW - 90, y: winH - 90 };
    await this.flyTo(this.homeCoords.x, this.homeCoords.y, speechText);
  }
  handleUserMouseMove(mouseX, mouseY) {
    if (this.isExecuting || this.isDodging)
      return;
    const isAtHome = Math.abs(this.currentCoords.x - this.homeCoords.x) < 45 && Math.abs(this.currentCoords.y - this.homeCoords.y) < 45;
    if (isAtHome)
      return;
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
    if (!element || !element.classList)
      return;
    element.classList.add("ostrovok-copilot-targeted");
    setTimeout(() => {
      element.classList.remove("ostrovok-copilot-targeted");
    }, 1200);
  }
  async smoothType(inputEl, text, charDelay = 35) {
    if (!inputEl)
      return;
    this.isExecuting = true;
    try {
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
    if (!room || !room.el)
      return;
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

// extension/src/voice.js
class VoiceController {
  constructor(onTranscript, onListeningChange) {
    this.onTranscript = onTranscript;
    this.onListeningChange = onListeningChange;
    this.recognition = null;
    this.isListening = false;
    this.initRecognition();
  }
  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition)
      return;
    this.recognition = new SpeechRecognition;
    this.recognition.lang = "ru-RU";
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onListeningChange)
        this.onListeningChange(true);
    };
    this.recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript && this.onTranscript) {
        this.onTranscript(transcript);
      }
    };
    this.recognition.onerror = () => {
      this.stop();
    };
    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onListeningChange)
        this.onListeningChange(false);
    };
  }
  start() {
    if (!this.recognition || this.isListening)
      return;
    try {
      this.recognition.start();
    } catch {}
  }
  stop() {
    if (!this.recognition || !this.isListening)
      return;
    try {
      this.recognition.stop();
    } catch {}
    this.isListening = false;
    if (this.onListeningChange)
      this.onListeningChange(false);
  }
  toggle() {
    if (this.isListening)
      this.stop();
    else
      this.start();
  }
}
function speakAloud(text) {
  if (typeof window === "undefined" || !window.speechSynthesis)
    return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[^\w\sа-яА-ЯёЁ.,!?-]/gi, "").trim();
    if (!cleanText)
      return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ru-RU";
    utterance.rate = 1.05;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch {}
}

// extension/src/intent-router.js
function extractTargetEntity(rawText) {
  return rawText.toLowerCase().replace(/^(найди|поищи|включи|поставь|выбери|добавь|покажи|отметь)\s+/i, "").replace(/\s+(и\s+включи|и\s+выбери|и\s+найди|фильтр|чекбокс)$/i, "").replace(/^(отель\s+в\s+|отели\s+в\s+|район\s+|достопримечательность\s+)/i, "").trim();
}
async function routeUserIntent(rawQuery, actor, thoughtLog, pageContext) {
  const query = (rawQuery || "").trim();
  if (!query)
    return;
  thoughtLog.clear();
  thoughtLog.addStep("intent", `Распознан запрос: "${query}"`);
  if (/что ты умеешь|что умеешь|помощь|help|кто ты/i.test(query)) {
    thoughtLog.addStep("dom", "Запрос возможностей агента");
    const reply = "Я нахожу любые районы, отели и достопримечательности, кручу слайдеры цен и довожу бронь до покупки.";
    actor.speak(reply, 5000);
    speakAloud(reply);
    thoughtLog.addStep("success", "Озвучен голосовой ответ возможностей");
    return;
  }
  if (/забронир|купи|оформ/i.test(query)) {
    thoughtLog.addStep("dom", "Поиск целевого тарифа и кнопки бронирования на Островке...");
    const ok = await actor.bookRoomOnOstrovok(pageContext.data?.recommendedRoom);
    if (ok) {
      thoughtLog.addStep("success", "Переход к реальному оформлению заказа на Островке");
    } else {
      thoughtLog.addStep("dom", "Кнопка бронирования не найдена на текущем экране");
      actor.speak("Ищу кнопку бронирования на странице...");
    }
    return;
  }
  const priceMatch = query.match(/(?:до|дешевле|не дороже|цена до)\s*(\d[\d\s]*)/i);
  if (priceMatch) {
    const rawVal = parseInt(priceMatch[1].replace(/\s+/g, ""), 10);
    if (rawVal > 0) {
      thoughtLog.addStep("dom", `Обнаружен фильтр цены: до ${rawVal} ₽`);
      const targetInput = document.querySelector('#price_to, input[name="price_to"]');
      if (targetInput)
        await actor.flyToElement(targetInput, `Ставлю цену до ${rawVal} ₽`);
      const ok = setPriceLimit(rawVal, document);
      if (ok) {
        thoughtLog.addStep("success", `Слайдер и инпут цены выставлены на ${rawVal} ₽`);
        actor.speak(`Цена до ${rawVal} ₽ установлена!`);
        return;
      }
    }
  }
  const distMatch = query.match(/(?:до|ближе чем)\s*(\d+)\s*км/i);
  if (distMatch) {
    const km = parseInt(distMatch[1], 10);
    thoughtLog.addStep("dom", `Обнаружен фильтр расстояния: до ${km} км`);
    const distEl = document.querySelector("#distance_filter\\.field");
    if (distEl)
      await actor.flyToElement(distEl, `Ставлю расстояние: ${km} км`);
    const ok = setDistanceLimit(km, document);
    if (ok) {
      thoughtLog.addStep("success", `Фильтр расстояния установлен на ${km} км`);
      actor.speak(`Расстояние до ${km} км установлено!`);
      return;
    }
  }
  if (/сначала дешев|подешев|по оценк|по рейтинг|по расстоян/i.test(query)) {
    const hint = /дешев/i.test(query) ? "дешев" : /оценк|рейтинг/i.test(query) ? "оценк" : "расстоян";
    thoughtLog.addStep("dom", `Настройка сортировки выдачи: ${hint}`);
    const ok = setSortOption(hint, document);
    if (ok) {
      thoughtLog.addStep("success", "Сортировка выдачи успешно изменена");
      actor.speak("Сортировка обновлена!");
      return;
    }
  }
  const target = extractTargetEntity(query);
  const desiredState = !/выключ|сними|убери|отключ/i.test(query);
  thoughtLog.addStep("dom", `Сканирую боковые фильтры на предмет: "${target}"...`);
  const filterMatched = await actor.toggleSemanticFilter(target, desiredState);
  if (filterMatched) {
    thoughtLog.addStep("success", `Фильтр «${target}» успешно переведен в состояние: ${desiredState ? "ВКЛ" : "ВЫКЛ"}`);
    return;
  }
  thoughtLog.addStep("dom", `«${target}» не найден в фильтрах текущей страницы. Проверяю поисковую строку направления...`);
  const searchSummary = document.querySelector('.SearchInfo_wrapper__iCRSw, [class*="SearchInfo"]');
  if (searchSummary && !document.querySelector('[data-testid="destination-input"]')) {
    searchSummary.click();
    await new Promise((r) => setTimeout(r, 400));
  }
  let destInput = document.querySelector('[data-testid="destination-input"], input[placeholder*="Куда"], input[name="destination"], input[placeholder*="Город"]');
  if (destInput) {
    thoughtLog.addStep("action", `Ввожу направление «${target}» в поисковую строку`);
    await actor.flyToElement(destInput, `Ввожу: ${target}`);
    await actor.smoothType(destInput, target);
    await new Promise((r) => setTimeout(r, 600));
    const suggest = document.querySelector('[class*="Suggest"] [role="option"], [class*="Suggest"] li, [class*="PlaceSuggest"] li');
    if (suggest) {
      suggest.click();
      thoughtLog.addStep("dom", "Выбран вариант из автодополнения");
    }
    const searchBtn = document.querySelector('[data-testid="search-button"], button[type="submit"]');
    if (searchBtn) {
      await actor.flyToElement(searchBtn, "Запускаю поиск!");
      searchBtn.click();
      thoughtLog.addStep("success", `Поиск по направлению «${target}» успешно запущен!`);
    }
    return;
  }
  thoughtLog.addStep("action", `Выполняю общий запрос: ${query}`);
  actor.speak(`Ищу: ${target || query}`);
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
  const recommendedRoom = rooms.find((r) => r.hasBreakfast) || rooms[0] || null;
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
  return {
    city: cityGuess,
    hotelCount
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
function getContextualChips(context, doc = document) {
  if (context.type === "HOTEL_DETAIL") {
    const chips = [{ label: "Забронировать на Островке", action: "book_on_ostrovok" }];
    if (context.data?.recommendedRoom) {
      chips.unshift({ label: context.data.recommendedRoom.title, action: "select_best_room" });
    }
    return chips;
  }
  if (context.type === "SERP") {
    const filterNodes = Array.from(doc.querySelectorAll('.FiltersListItem_root__UH0W8, [class*="FiltersListItem"], [class*="SwitchableFilter_label"]'));
    const extracted = [];
    for (const node of filterNodes) {
      const labelText = node.textContent?.replace(/\d+$/, "").trim() || "";
      const countEl = node.parentElement?.querySelector('[class*="count"]') || node.querySelector('[class*="count"]');
      const count = countEl ? parseInt(countEl.textContent || "0", 10) : 1;
      if (labelText && count > 0 && !extracted.some((c) => c.label === labelText)) {
        extracted.push({ label: labelText, action: `filter_${labelText}` });
      }
      if (extracted.length >= 4)
        break;
    }
    if (extracted.length > 0)
      return extracted;
    return [
      { label: "С завтраком", action: "filter_завтрак" },
      { label: "С бассейном", action: "filter_бассейн" }
    ];
  }
  const destLinks = Array.from(doc.querySelectorAll('a[href*="/hotel/russia/"], a[href*="/hotel/"]')).map((a) => a.textContent?.trim() || "").filter((txt) => txt.length > 2 && txt.length < 25 && !/отели/i.test(txt));
  const uniqueDests = Array.from(new Set(destLinks)).slice(0, 4);
  if (uniqueDests.length > 0) {
    return uniqueDests.map((dest) => ({ label: dest, action: `search_${dest}` }));
  }
  return [
    { label: "Поиск направления", action: "focus_destination" }
  ];
}

// extension/src/thought-log.js
class ThoughtLog {
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
    if (this.hideTimeout)
      clearTimeout(this.hideTimeout);
    this.container.classList.add("visible");
  }
  hide(delayMs = 0) {
    if (delayMs > 0) {
      if (this.hideTimeout)
        clearTimeout(this.hideTimeout);
      this.hideTimeout = setTimeout(() => {
        this.container.classList.remove("visible");
      }, delayMs);
    } else {
      this.container.classList.remove("visible");
    }
  }
  clear() {
    if (this.listEl)
      this.listEl.innerHTML = "";
  }
  addStep(tag, text) {
    this.show();
    if (!this.listEl)
      return;
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
    this.hide(6000);
  }
}

// extension/content.js
(function initOstrovokCopilot() {
  function start() {
    if (document.getElementById("ostrovok-copilot-shadow-host"))
      return;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", start);
      return;
    }
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
    flyerEl.addEventListener("click", () => {
      actionBar.classList.toggle("open");
      if (actionBar.classList.contains("open")) {
        inputEl.focus();
      }
    });
    window.addEventListener("mousemove", (e) => {
      const rect = canvasEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth / 2);
      const dy = (e.clientY - cy) / (window.innerHeight / 2);
      ghostCanvas.setLookTarget(dx, dy);
      actor.handleUserMouseMove(e.clientX, e.clientY);
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
        btn.addEventListener("click", () => {
          const text = c.action === "toggle_chistyakovskaya" ? "Чистяковская роща" : c.label;
          routeUserIntent(text, actor, thoughtLog, pageContext);
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
    const voice = new VoiceController((transcript) => {
      inputEl.value = transcript;
      routeUserIntent(transcript, actor, thoughtLog, pageContext);
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
      routeUserIntent(query, actor, thoughtLog, pageContext);
    });
  }
  start();
})();
