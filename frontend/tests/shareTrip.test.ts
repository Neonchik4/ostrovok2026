import { describe, expect, it, vi } from "vitest";

import {
  buildShareTripUrl,
  decodeTripState,
  encodeTripState,
  toCompactHotelSnapshot,
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

  it("compacts hotel data stripping heavy reviews and keeping essential booking details", () => {
    const rawHotel = {
      id: "hotel-spb-77",
      name: "Гранд Отель Европа",
      city: "Санкт-Петербург",
      stars: 5,
      area: "Центральный",
      area_type: "center",
      address: "ул. Михайловская, 1/7",
      rating: 9.6,
      reviews_count: 512,
      match_score_pct: 98,
      min_price_per_night_rub: 18500,
      image_urls: ["/img1.jpg", "/img2.jpg", "/img3.jpg", "/img4.jpg"],
      tags: ["Исторический", "Центр", "Люкс", "Завтрак", "Спа"],
      reviews: [
        {
          id: 1,
          author: "Иван",
          date: "2026-05-10",
          rating: 10,
          plus: "Прекрасный отель",
          minus: "",
        },
      ],
      receipt: {
        nights: 2,
        price_per_night_rub: 18500,
        base_cost_rub: 37000,
        pet_deposit_rub: 0,
        resort_tax_rub: 200,
        total_rub: 37200,
        tickets_count: 2,
        is_free_cancellation: true,
      },
    };

    const compact = toCompactHotelSnapshot(rawHotel);

    expect(compact.id).toBe("hotel-spb-77");
    expect(compact.name).toBe("Гранд Отель Европа");
    expect(compact.image_urls).toHaveLength(2);
    expect(compact.tags).toHaveLength(4);
    expect(compact.receipt?.total_rub).toBe(37200);
    // Reviews are stripped for lightweight URL size
    expect((compact as Record<string, unknown>).reviews).toBeUndefined();
  });

  it("encodes and restores shared trip state with hotels and assistant summary", () => {
    const stateWithHotels: TripShareState = {
      city: "Казань",
      nights: 3,
      guests: 2,
      selected_hotel_id: "kazan-palace",
      user_message: "Поездка в Казань на двоих",
      assistant_message: "Вот готовая подборка отелей в Казани.",
      hotels: [
        {
          id: "kazan-palace",
          name: "Kazan Palace by Tasigo",
          city: "Казань",
          stars: 5,
          rating: 9.7,
          reviews_count: 210,
          match_score_pct: 97,
          min_price_per_night_rub: 14000,
          image_urls: ["/kazan1.jpg"],
          receipt: {
            nights: 3,
            price_per_night_rub: 14000,
            base_cost_rub: 42000,
            pet_deposit_rub: 0,
            resort_tax_rub: 0,
            total_rub: 42000,
            tickets_count: 2,
            is_free_cancellation: true,
          },
        },
      ],
    };

    const token = encodeTripState(stateWithHotels);
    const decoded = decodeTripState(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.hotels).toHaveLength(1);
    expect(decoded?.hotels?.[0].name).toBe("Kazan Palace by Tasigo");
    expect(decoded?.hotels?.[0].receipt?.total_rub).toBe(42000);
    expect(decoded?.assistant_message).toBe("Вот готовая подборка отелей в Казани.");
  });
});
