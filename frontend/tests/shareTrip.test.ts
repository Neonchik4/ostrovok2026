import { describe, expect, it, vi } from "vitest";

import {
  buildShareTripUrl,
  decodeTripState,
  encodeTripState,
  TripShareState,
} from "../src/features/share-trip";

describe("Share Trip Deep-Link Serialization & Deserialization", () => {
  it("successfully encodes and decodes complete trip state with unicode characters", () => {
    const originalState: TripShareState = {
      city: "Красная Поляна",
      origin_city: "Москва",
      depart_date: "2026-11-15",
      nights: 4,
      guests: 2,
      stars: 4,
      max_price_per_night_rub: 15000,
      selected_hotel_id: "kp-resort-123",
      pet_friendly: true,
      heated_pool: true,
      transport_preference: "train",
      user_message: "Красная Поляна на двоих с собакой и теплым бассейном",
    };

    const token = encodeTripState(originalState);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    // Base64URL safe characters check
    expect(token).not.toContain("+");
    expect(token).not.toContain("/");
    expect(token).not.toContain("=");

    const decoded = decodeTripState(token);
    expect(decoded).toEqual(originalState);
  });

  it("handles empty or partial trip state gracefully", () => {
    const minimalState: TripShareState = {
      city: "Санкт-Петербург",
    };

    const token = encodeTripState(minimalState);
    const decoded = decodeTripState(token);
    expect(decoded?.city).toBe("Санкт-Петербург");
  });

  it("returns null on corrupt or invalid tokens (Secure by Design)", () => {
    expect(decodeTripState("")).toBeNull();
    expect(decodeTripState("not-a-valid-base64-json!#@$")).toBeNull();
    expect(decodeTripState("eyJuYW1lIjogIjEyMyJ9_corrupt")).toBeNull();
  });

  it("builds canonical share url with ?trip= parameter", () => {
    const state: TripShareState = {
      city: "Сочи",
      guests: 3,
    };

    const url = buildShareTripUrl(state, "https://ostrovok.tech/chat");
    expect(url).toContain("https://ostrovok.tech/chat?trip=");

    const token = url.split("?trip=")[1];
    const decoded = decodeTripState(token);
    expect(decoded?.city).toBe("Сочи");
    expect(decoded?.guests).toBe(3);
  });
});
