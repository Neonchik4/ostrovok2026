import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectPageContext, getContextualChips } from "../../extension/src/page-analyzer.js";
import {
  findFilterElement,
  setCheckboxSemanticState,
  setDistanceLimit,
  setPriceLimit,
} from "../../extension/src/semantic-dom.js";

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
});
