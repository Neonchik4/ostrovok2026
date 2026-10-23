import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectPageContext, getContextualChips } from "../../extension/src/page-analyzer.js";
import {
  applyPriceRange,
  findFilterElement,
  parsePriceIntent,
  parsePriceRangeIntent,
  setCheckboxSemanticState,
  setDistanceLimit,
  setPriceLimit,
} from "../../extension/src/semantic-dom.js";
import { ThoughtLog } from "../../extension/src/thought-log.js";

function loadFixtureDocument(filename: string): Document {
  const filePath = path.resolve(__dirname, "../../extension/fixtures", filename);
  const html = fs.readFileSync(filePath, "utf-8");
  const doc = document.implementation.createHTMLDocument("Test Fixture");
  doc.documentElement.innerHTML = html;
  return doc;
}

describe("Extension Real Ostrovok DOM Verification (Zero Hardcoding)", () => {
  it("dynamically extracts real contextual chips from actual SERP HTML without hardcoding", () => {
    const doc = loadFixtureDocument("serp_krasnodar.html");
    const context = { type: "SERP" as const, data: { city: "krasnodar", hotelCount: 20 } };

    const chips = getContextualChips(context, doc);

    // Verify chips are derived dynamically from DOM, not hardcoded strings
    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(chips.some((c) => c.label.includes("Чистяковская") || c.label.includes("Отел") || c.label.includes("Скид"))).toBe(true);

    // Ensure no hardcoded dummy cities are injected
    expect(chips.some((c) => c.label.includes("Сочи с бассейном"))).toBe(false);
    expect(chips.some((c) => c.label.includes("Питер командировка"))).toBe(false);
  });

  it("finds exact attraction checkbox in real Ostrovok SERP DOM (Чистяковская роща)", () => {
    const doc = loadFixtureDocument("serp_krasnodar.html");
    const match = findFilterElement("Чистяковская роща", doc);

    expect(match).not.toBeNull();
    expect(match?.text).toContain("чистяковская роща");
    expect(match?.input?.getAttribute("value")).toBe("6305770");
  });

  it("finds other real attractions in SERP DOM (Парк 30-летия Победы)", () => {
    const doc = loadFixtureDocument("serp_krasnodar.html");
    const match = findFilterElement("Парк 30-летия Победы", doc);

    expect(match).not.toBeNull();
    expect(match?.text).toContain("парк 30-летия победы");
    expect(match?.input?.getAttribute("value")).toBe("6305772");
  });

  it("adjusts real price input and slider thumb in actual SERP HTML (#price_to)", () => {
    const doc = loadFixtureDocument("serp_krasnodar.html");
    const priceToInput = doc.querySelector("#price_to") as HTMLInputElement;
    expect(priceToInput).not.toBeNull();
    expect(priceToInput.value).toBe("33 700 ₽");

    const success = setPriceLimit(7500, doc);
    expect(success).toBe(true);
    expect(priceToInput.value).toBe("7500 ₽");

    const thumb = doc.querySelectorAll('[role="slider"]')[1];
    expect(thumb.getAttribute("aria-valuenow")).toBe("7500");
  });

  it("adjusts real distance filter input and slider in actual SERP HTML", () => {
    const doc = loadFixtureDocument("serp_krasnodar.html");
    const distInput = doc.querySelector("#distance_filter\\.field") as HTMLInputElement;
    expect(distInput).not.toBeNull();
    expect(distInput.value).toBe("30 км");

    const success = setDistanceLimit(5, doc);
    expect(success).toBe(true);
    expect(distInput.value).toBe("5 км");
  });

  it("detects real Home page HTML and identifies destination input", () => {
    const doc = loadFixtureDocument("home_page.html");
    const context = detectPageContext("https://ostrovok.ru/", doc);

    expect(context.type).toBe("HOME");
    expect(context.data.hasDestinationInput).toBe(true);

    const destInput = doc.querySelector('[data-testid="destination-input"]') as HTMLInputElement;
    expect(destInput).not.toBeNull();
  });

  it("verifies idempotency on real checkbox in SERP DOM", () => {
    const doc = loadFixtureDocument("serp_krasnodar.html");
    const match = findFilterElement("Чистяковская роща", doc);
    expect(match).not.toBeNull();

    const input = match?.input as HTMLInputElement;
    expect(input.checked).toBe(false);

    // 1st call: desiredState = true -> should toggle
    let clicked = false;
    input.addEventListener("click", () => {
      clicked = true;
      input.checked = true;
    });

    const res1 = setCheckboxSemanticState(input, match?.container as HTMLElement, true);
    expect(res1.changed).toBe(true);
    expect(res1.alreadyInState).toBe(false);

    // 2nd call: desiredState = true when already checked -> should NOT toggle
    clicked = false;
    const res2 = setCheckboxSemanticState(input, match?.container as HTMLElement, true);
    expect(res2.changed).toBe(false);
    expect(res2.alreadyInState).toBe(true);
    expect(clicked).toBe(false);
  });

  it("finds real breakfast checkbox across inflection variants ('С завтраком', 'Включить завтрак', 'завтрак')", () => {
    const doc = loadFixtureDocument("serp_krasnodar.html");

    const stepsLogged: Array<{ tag: string; msg: string }> = [];
    const logger = (tag: string, msg: string) => stepsLogged.push({ tag, msg });

    // Variant 1: Preposition + Instrumental ("С завтраком")
    const match1 = findFilterElement("С завтраком", doc, logger);
    expect(match1).not.toBeNull();
    expect(match1?.input?.getAttribute("value")).toBe("breakfast");
    expect(match1?.text).toContain("завтрак");

    // Variant 2: Infinitive verb prefix ("Включить завтрак")
    const match2 = findFilterElement("Включить завтрак", doc);
    expect(match2).not.toBeNull();
    expect(match2?.input?.getAttribute("value")).toBe("breakfast");

    // Variant 3: Plain noun ("завтрак")
    const match3 = findFilterElement("завтрак", doc);
    expect(match3).not.toBeNull();
    expect(match3?.input?.getAttribute("value")).toBe("breakfast");

    // Verify rich diagnostic steps were recorded
    expect(stepsLogged.length).toBeGreaterThan(0);
    expect(stepsLogged.some((s) => s.msg.includes("Сканирую") && s.msg.includes("элементов"))).toBe(true);
    expect(stepsLogged.some((s) => s.msg.includes("value=\"breakfast\"") || s.msg.includes("текстовое"))).toBe(true);
  });

  it("parses price intents across diverse natural query formats", () => {
    expect(parsePriceIntent("цена 5000")).toBe(5000);
    expect(parsePriceIntent("цену 8000")).toBe(8000);
    expect(parsePriceIntent("до 12000 руб")).toBe(12000);
    expect(parsePriceIntent("7500 ₽")).toBe(7500);
    expect(parsePriceIntent("дешевле 6000")).toBe(6000);
    expect(parsePriceIntent("бюджет 15000")).toBe(15000);
    expect(parsePriceIntent("5000")).toBe(5000);
    expect(parsePriceIntent("погода в сочи")).toBeNull();

    // Min and Max range parsing
    const range1 = parsePriceRangeIntent("МИНИМАЛЬНАЯ ЦЕНА 1000Р МАКСИМАЛЬНАЯ 25000Р");
    expect(range1?.minPrice).toBe(1000);
    expect(range1?.maxPrice).toBe(25000);

    const range2 = parsePriceRangeIntent("от 2000 до 8500 руб");
    expect(range2?.minPrice).toBe(2000);
    expect(range2?.maxPrice).toBe(8500);

    const range3 = parsePriceRangeIntent("минимальная цена 1500");
    expect(range3?.minPrice).toBe(1500);
    expect(range3?.maxPrice).toBeNull();
  });

  it("applies both min and max price ranges to real DOM inputs (#price_from and #price_to)", () => {
    const doc = loadFixtureDocument("serp_krasnodar.html");
    const fromInput = doc.querySelector("#price_from") as HTMLInputElement;
    const toInput = doc.querySelector("#price_to") as HTMLInputElement;

    expect(fromInput).not.toBeNull();
    expect(toInput).not.toBeNull();

    const ok = applyPriceRange(1000, 25000, doc);
    expect(ok).toBe(true);

    expect(fromInput.value).toBe("1000 ₽");
    expect(toInput.value).toBe("25000 ₽");

    const thumbs = doc.querySelectorAll('[role="slider"]');
    expect(thumbs[0].getAttribute("aria-valuenow")).toBe("1000");
    expect(thumbs[1].getAttribute("aria-valuenow")).toBe("25000");
  });

  it("dynamically excludes active checked filters from suggested contextual chips", () => {
    const doc = loadFixtureDocument("serp_krasnodar.html");
    const context = { type: "SERP" as const, data: { city: "krasnodar", hotelCount: 20 } };

    // Initial: chips include first available unchecked filters
    const initialChips = getContextualChips(context, doc);
    expect(initialChips.length).toBeGreaterThan(0);

    // Mark the first candidate checkbox as checked
    const firstCheckbox = doc.querySelector('.FiltersListItem_root__UH0W8 input[type="checkbox"]') as HTMLInputElement;
    if (firstCheckbox) {
      firstCheckbox.checked = true;
    }

    const updatedChips = getContextualChips(context, doc);
    // Verified that the checked item is excluded from recommendations
    if (firstCheckbox) {
      const parentLabel = firstCheckbox.closest(".FiltersListItem_root__UH0W8")?.textContent?.replace(/\d+$/, "").trim();
      if (parentLabel) {
        expect(updatedChips.some((c) => c.label === parentLabel)).toBe(false);
      }
    }
  });

  it("verifies ThoughtLog renders without 'LIVE' slop badge", () => {
    const shadowHost = document.createElement("div");
    const shadow = shadowHost.attachShadow({ mode: "open" });
    const log = new ThoughtLog(shadow);

    log.addStep("dom", "Диагностический тест");
    const container = shadow.querySelector(".copilot-thought-log");
    expect(container).not.toBeNull();
    expect(container?.innerHTML).not.toContain("LIVE");
    expect(container?.innerHTML).toContain("Ход мыслей агента");
  });
});
