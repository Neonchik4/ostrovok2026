import { describe, expect, it } from "vitest";

import { pluralizeGuests, pluralizeNights } from "@/shared/lib";

describe("pluralizeGuests", () => {
  it("formats singular (1, 21, 31, 101 гость)", () => {
    expect(pluralizeGuests(1)).toBe("1 гость");
    expect(pluralizeGuests(21)).toBe("21 гость");
    expect(pluralizeGuests(101)).toBe("101 гость");
  });

  it("formats genitive singular (2, 3, 4, 22, 23, 24 гостя)", () => {
    expect(pluralizeGuests(2)).toBe("2 гостя");
    expect(pluralizeGuests(3)).toBe("3 гостя");
    expect(pluralizeGuests(4)).toBe("4 гостя");
    expect(pluralizeGuests(22)).toBe("22 гостя");
  });

  it("formats genitive plural (5..20, 25..30 гостей)", () => {
    expect(pluralizeGuests(5)).toBe("5 гостей");
    expect(pluralizeGuests(6)).toBe("6 гостей");
    expect(pluralizeGuests(11)).toBe("11 гостей");
    expect(pluralizeGuests(12)).toBe("12 гостей");
    expect(pluralizeGuests(14)).toBe("14 гостей");
    expect(pluralizeGuests(20)).toBe("20 гостей");
    expect(pluralizeGuests(25)).toBe("25 гостей");
  });
});

describe("pluralizeNights", () => {
  it("formats singular (1, 21 ночь)", () => {
    expect(pluralizeNights(1)).toBe("1 ночь");
    expect(pluralizeNights(21)).toBe("21 ночь");
  });

  it("formats 2-4 (2, 3, 4, 24 ночи)", () => {
    expect(pluralizeNights(2)).toBe("2 ночи");
    expect(pluralizeNights(3)).toBe("3 ночи");
    expect(pluralizeNights(4)).toBe("4 ночи");
    expect(pluralizeNights(24)).toBe("24 ночи");
  });

  it("formats 5+ (5..20 ночей)", () => {
    expect(pluralizeNights(5)).toBe("5 ночей");
    expect(pluralizeNights(11)).toBe("11 ночей");
    expect(pluralizeNights(14)).toBe("14 ночей");
    expect(pluralizeNights(20)).toBe("20 ночей");
  });
});
