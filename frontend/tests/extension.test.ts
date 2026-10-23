import { describe, expect, it } from "vitest";
import { attachMatchBadge, scrapeTopHotel, setReactInputValue } from "../../extension/src/dom-actor.js";
import { GhostActor, shortenText } from "../../extension/src/ghost-actor.js";
import { getDeterministicFallbackPlan } from "../../extension/src/network.js";
import { detectPageContext, getContextualChips } from "../../extension/src/page-analyzer.js";
import { findFilterElement, setCheckboxSemanticState } from "../../extension/src/semantic-dom.js";

describe("Extension Network Fallback Planner", () => {
  it("extracts Sochi destination and returns structured action steps", () => {
    const plan = getDeterministicFallbackPlan("Хочу в Сочи с подогреваемым бассейном", "bro");
    expect(plan.persona).toBe("bro");
    expect(plan.speech).toContain("Сочи");
    expect(plan.steps.length).toBeGreaterThanOrEqual(4);

    const destStep = plan.steps.find((s) => s.action === "set_destination");
    expect(destStep).toBeDefined();
    expect(destStep?.value).toBe("Сочи");
  });

  it("extracts Saint Petersburg destination correctly", () => {
    const plan = getDeterministicFallbackPlan("Командировка в Питер на 2 дня", "assistant");
    expect(plan.persona).toBe("assistant");
    expect(plan.speech).toContain("Санкт-Петербург");
    const destStep = plan.steps.find((s) => s.action === "set_destination");
    expect(destStep?.value).toBe("Санкт-Петербург");
  });

  it("extracts Moscow destination correctly", () => {
    const plan = getDeterministicFallbackPlan("Отель в центре Москвы люкс", "concierge");
    expect(plan.persona).toBe("concierge");
    expect(plan.speech).toContain("Москва");
    const destStep = plan.steps.find((s) => s.action === "set_destination");
    expect(destStep?.value).toBe("Москва");
  });
});

describe("Extension Page Analyzer (Multi-Page DOM Intelligence)", () => {
  it("accurately detects HOTEL_DETAIL page and extracts rooms", () => {
    const fakeDoc = document.implementation.createHTMLDocument("Hotel Detail");
    fakeDoc.body.innerHTML = `
      <h1>Отель Marriott Краснодар</h1>
      <div data-testid="hotel-card-rating">9.4</div>
      <div class="Room_root">
        <div class="Title">Стандарт без питания</div>
        <div class="Price">4 500 ₽</div>
      </div>
      <div class="Room_root">
        <div class="Title">Стандарт с завтраком</div>
        <div class="Price">5 100 ₽</div>
      </div>
    `;

    const url = "https://ostrovok.ru/hotel/russia/krasnodar/mid9250755/parallel_hotel/?dates=24.10.2026-25.10.2026&guests=2";
    const context = detectPageContext(url, fakeDoc);

    expect(context.type).toBe("HOTEL_DETAIL");
    expect(context.data.hotelName).toBe("Отель Marriott Краснодар");
    expect(context.data.roomsCount).toBe(2);
    expect(context.data.recommendedRoom?.title).toContain("с завтраком");

    const chips = getContextualChips(context, fakeDoc);
    expect(chips.some((c) => c.action === "select_best_room")).toBe(true);
    expect(chips.some((c) => c.action === "book_on_ostrovok")).toBe(true);
  });

  it("accurately detects SERP search results page and dynamically extracts filters", () => {
    const fakeDoc = document.implementation.createHTMLDocument("SERP");
    fakeDoc.body.innerHTML = `
      <div class="FiltersListItem_root__UH0W8"><label><input type="checkbox" /> Завтрак включен</label><span class="count">15</span></div>
      <div class="FiltersListItem_root__UH0W8"><label><input type="checkbox" /> Бассейн</label><span class="count">8</span></div>
      <div data-testid="serp-hotelcard">Hotel 1</div>
      <div data-testid="serp-hotelcard">Hotel 2</div>
    `;

    const url = "https://ostrovok.ru/hotel/russia/krasnodar/?search=yes&dates=24.10.2026-25.10.2026&guests=2";
    const context = detectPageContext(url, fakeDoc);

    expect(context.type).toBe("SERP");
    expect(context.data.city).toBe("krasnodar");
    expect(context.data.hotelCount).toBe(2);

    const chips = getContextualChips(context, fakeDoc);
    expect(chips.some((c) => c.label.includes("Завтрак"))).toBe(true);
    expect(chips.some((c) => c.label.includes("Бассейн"))).toBe(true);
  });

  it("accurately detects HOME page and identifies destination search", () => {
    const fakeDoc = document.implementation.createHTMLDocument("Home");
    fakeDoc.body.innerHTML = `
      <input data-testid="destination-input" placeholder="Город или отель" />
      <button data-testid="search-button">Найти</button>
      <a href="/hotel/russia/krasnodar/">Краснодар</a>
    `;

    const url = "https://ostrovok.ru/";
    const context = detectPageContext(url, fakeDoc);

    expect(context.type).toBe("HOME");
    expect(context.data.hasDestinationInput).toBe(true);
    expect(context.data.hasSearchButton).toBe(true);

    const chips = getContextualChips(context, fakeDoc);
    expect(chips.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Dynamic Semantic DOM Matcher & Idempotence", () => {
  it("finds attraction checkbox by name even when text has extra formatting", () => {
    const container = document.createElement("div");
    container.className = "FiltersListItem_root__UH0W8";
    container.innerHTML = `
      <label class="Default_label__IBdHV">
        <input class="Default_control__XCUf7" type="checkbox" value="6305770">
        <span class="Default_text__Hxt_I"><span>Чистяковская роща</span></span>
      </label>
    `;
    document.body.appendChild(container);

    const match = findFilterElement("включи чистяковская роща");
    expect(match).not.toBeNull();
    expect(match?.text).toContain("чистяковская роща");
    expect(match?.input).not.toBeNull();

    container.remove();
  });

  it("idempotently checks: does not uncheck if already enabled", () => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true; // already checked!
    label.appendChild(input);
    document.body.appendChild(label);

    let clicked = false;
    input.addEventListener("click", () => { clicked = true; });

    const res = setCheckboxSemanticState(input, label, true);
    expect(res.alreadyInState).toBe(true);
    expect(res.changed).toBe(false);
    expect(clicked).toBe(false); // Did NOT click, kept checked!

    label.remove();
  });

  it("unchecks only when desiredState is false and currently checked", () => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    label.appendChild(input);
    document.body.appendChild(label);

    let clicked = false;
    input.addEventListener("click", () => { clicked = true; });

    const res = setCheckboxSemanticState(input, label, false);
    expect(res.alreadyInState).toBe(false);
    expect(res.changed).toBe(true);
    expect(clicked).toBe(true);

    label.remove();
  });
});

describe("Extension DOM, Speech & Evasion Actor", () => {
  it("shortens text properly so it does not overflow viewport", () => {
    const long = "Это очень длинный текст ответа агента, который раньше вылезал за границы экрана и портил весь интерфейс пользователю";
    const short = shortenText(long, 40);
    expect(short.length).toBeLessThanOrEqual(40);
    expect(short).toContain("...");
  });

  it("dodges back to home dock when user mouse approaches within 80px", () => {
    const flyer = document.createElement("div");
    const bubble = document.createElement("div");
    const mockCanvas = { setState: () => {}, setTilt: () => {} } as any;

    const actor = new GhostActor(flyer, mockCanvas, bubble);
    // Simulate ghost in the middle of page
    actor.currentCoords = { x: 500, y: 500 };
    actor.homeCoords = { x: 950, y: 700 };

    let flyCalled = false;
    actor.flyTo = async () => { flyCalled = true; };

    // Mouse near ghost (dx=20, dy=20, dist ~ 28px)
    actor.handleUserMouseMove(520, 520);
    expect(actor.isDodging).toBe(true);
    expect(flyCalled).toBe(true);
  });

  it("does not dodge when peacefully docked in home corner", () => {
    const flyer = document.createElement("div");
    const bubble = document.createElement("div");
    const mockCanvas = { setState: () => {}, setTilt: () => {} } as any;

    const actor = new GhostActor(flyer, mockCanvas, bubble);
    actor.currentCoords = { x: 950, y: 700 };
    actor.homeCoords = { x: 950, y: 700 };

    let flyCalled = false;
    actor.flyTo = async () => { flyCalled = true; };

    // Mouse directly on ghost at home corner
    actor.handleUserMouseMove(950, 700);
    expect(actor.isDodging).toBe(false);
    expect(flyCalled).toBe(false);
  });

  it("locates and clicks real Ostrovok booking button to drive checkout", async () => {
    const flyer = document.createElement("div");
    const bubble = document.createElement("div");
    const mockCanvas = { setState: () => {}, setTilt: () => {} } as any;

    const actor = new GhostActor(flyer, mockCanvas, bubble);

    const roomEl = document.createElement("div");
    roomEl.className = "Room_root";
    const bookBtn = document.createElement("button");
    bookBtn.setAttribute("data-testid", "book-button");
    bookBtn.textContent = "Забронировать";
    roomEl.appendChild(bookBtn);
    document.body.appendChild(roomEl);

    let booked = false;
    bookBtn.addEventListener("click", () => { booked = true; });

    const success = await actor.bookRoomOnOstrovok({ el: roomEl });
    expect(success).toBe(true);
    expect(booked).toBe(true);

    roomEl.remove();
  });

  it("dispatches input and change events when setting React input value", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);

    let inputFired = false;
    let changeFired = false;
    input.addEventListener("input", () => { inputFired = true; });
    input.addEventListener("change", () => { changeFired = true; });

    setReactInputValue(input, "Красная Поляна");

    expect(input.value).toBe("Красная Поляна");
    expect(inputFired).toBe(true);
    expect(changeFired).toBe(true);

    input.remove();
  });

  it("attaches match badge and glow border to hotel card", () => {
    const card = document.createElement("div");
    card.setAttribute("data-testid", "serp-hotelcard");
    document.body.appendChild(card);

    attachMatchBadge(card, "98% совпадение • Спа-комплекс");

    const badge = card.querySelector(".ostrovok-copilot-injected-badge");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("98% совпадение • Спа-комплекс");
    expect(card.style.borderColor).toBe("rgb(22, 82, 240)");

    card.remove();
  });

  it("scrapes top hotel data from card DOM elements", () => {
    const card = document.createElement("div");
    card.setAttribute("data-testid", "serp-hotelcard");
    card.innerHTML = `
      <div data-testid="hotel-card-name">Гранд Отель Поляна</div>
      <div data-testid="hotel-card-price-value">от 12 400 ₽</div>
      <div data-testid="hotel-card-rating">9.6</div>
      <img src="https://cdn.ostrovok.ru/hotel/1.jpg" alt="Hotel" />
    `;
    document.body.appendChild(card);

    const scraped = scrapeTopHotel();
    expect(scraped).not.toBeNull();
    expect(scraped?.name).toBe("Гранд Отель Поляна");
    expect(scraped?.price).toBe("от 12 400 ₽");
    expect(scraped?.rating).toBe("9.6");
    expect(scraped?.imgSrc).toContain("hotel/1.jpg");

    card.remove();
  });
});

describe("Intent Router & Wild Thought Stream Logging", () => {
  it("extracts target entity cleanly from arbitrary queries", async () => {
    const { extractTargetEntity } = await import("../../extension/src/intent-router.js");
    expect(extractTargetEntity("найди Лазаревское и включи")).toBe("лазаревское");
    expect(extractTargetEntity("выбери Чистяковская роща")).toBe("чистяковская роща");
    expect(extractTargetEntity("включи бассейн")).toBe("бассейн");
    expect(extractTargetEntity("поставь отель в Сочи")).toBe("сочи");
  });

  it("appends and formats SSE thought log steps with live tags", async () => {
    const { ThoughtLog } = await import("../../extension/src/thought-log.js");
    const container = document.createElement("div");
    document.body.appendChild(container);

    const log = new ThoughtLog(container);
    log.addStep("intent", "Запрос пользователя: найди Лазаревское");
    log.addStep("dom", "Сканирую фильтры страницы...");
    log.addStep("action", "Лечу к чекбоксу Лазаревское");

    const items = container.querySelectorAll(".thought-log-item");
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain("[ИНТЕНТ]");
    expect(items[1].textContent).toContain("[DOM]");
    expect(items[2].textContent).toContain("[ДЕЙСТВИЕ]");

    container.remove();
  });

  it("does not dodge while executing a user action", () => {
    const flyer = document.createElement("div");
    const bubble = document.createElement("div");
    const mockCanvas = { setState: () => {}, setTilt: () => {} } as any;

    const actor = new GhostActor(flyer, mockCanvas, bubble);
    actor.currentCoords = { x: 400, y: 400 };
    actor.homeCoords = { x: 900, y: 700 };

    let flyCalled = false;
    actor.flyTo = async () => { flyCalled = true; };

    // Set busy execution lock
    actor.isExecuting = true;

    // Mouse near ghost (within 80px)
    actor.handleUserMouseMove(420, 420);
    // Should NOT dodge because action is in progress!
    expect(actor.isDodging).toBe(false);
    expect(flyCalled).toBe(false);

    // Release busy lock
    actor.isExecuting = false;
    actor.handleUserMouseMove(420, 420);
    // Now it dodges!
    expect(actor.isDodging).toBe(true);
    expect(flyCalled).toBe(true);
  });
});
