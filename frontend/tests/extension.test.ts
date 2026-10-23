import { describe, expect, it } from "vitest";
import { attachMatchBadge, scrapeTopHotel, setReactInputValue } from "../../extension/src/dom-actor.js";
import { GhostActor } from "../../extension/src/ghost-actor.js";
import { getDeterministicFallbackPlan } from "../../extension/src/network.js";
import { detectPageContext, getContextualChips } from "../../extension/src/page-analyzer.js";

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

    const chips = getContextualChips(context);
    expect(chips.some((c) => c.action === "select_best_room")).toBe(true);
    expect(chips.some((c) => c.action === "book_on_ostrovok")).toBe(true);
    expect(chips.some((c) => c.action === "show_route_planner")).toBe(true);
  });

  it("accurately detects SERP search results page and filters", () => {
    const fakeDoc = document.implementation.createHTMLDocument("SERP");
    fakeDoc.body.innerHTML = `
      <label class="FilterCheckbox"><input type="checkbox" /> Завтрак включен</label>
      <label class="FilterCheckbox"><input type="checkbox" /> Бассейн</label>
      <div data-testid="serp-hotelcard">Hotel 1</div>
      <div data-testid="serp-hotelcard">Hotel 2</div>
    `;

    const url = "https://ostrovok.ru/hotel/russia/krasnodar/?search=yes&dates=24.10.2026-25.10.2026&guests=2";
    const context = detectPageContext(url, fakeDoc);

    expect(context.type).toBe("SERP");
    expect(context.data.city).toBe("krasnodar");
    expect(context.data.hotelCount).toBe(2);
    expect(context.data.hasBreakfastFilter).toBe(true);
    expect(context.data.hasPoolFilter).toBe(true);

    const chips = getContextualChips(context);
    expect(chips.some((c) => c.action === "toggle_breakfast")).toBe(true);
    expect(chips.some((c) => c.action === "toggle_pool")).toBe(true);
  });

  it("accurately detects HOME page and suggests popular destinations", () => {
    const fakeDoc = document.implementation.createHTMLDocument("Home");
    fakeDoc.body.innerHTML = `
      <input data-testid="destination-input" placeholder="Город или отель" />
      <button data-testid="search-button">Найти</button>
    `;

    const url = "https://ostrovok.ru/";
    const context = detectPageContext(url, fakeDoc);

    expect(context.type).toBe("HOME");
    expect(context.data.hasDestinationInput).toBe(true);
    expect(context.data.hasSearchButton).toBe(true);

    const chips = getContextualChips(context);
    expect(chips.some((c) => c.action === "search_krasnodar")).toBe(true);
  });
});

describe("Extension DOM & Flight Actor", () => {
  it("toggles filter checkbox by keyword and triggers click", async () => {
    const flyer = document.createElement("div");
    const bubble = document.createElement("div");
    const mockCanvas = { setState: () => {}, setTilt: () => {} } as any;

    const actor = new GhostActor(flyer, mockCanvas, bubble);

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode("Бассейн с подогревом"));
    document.body.appendChild(label);

    let clicked = false;
    checkbox.addEventListener("click", () => { clicked = true; });

    const toggled = await actor.toggleFilterCheckbox("бассейн");
    expect(toggled).toBe(true);
    expect(clicked).toBe(true);

    label.remove();
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
