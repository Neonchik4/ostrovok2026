import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "../src/app/page";
import { encodeTripState } from "../src/features/share-trip";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/shared/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useChatStream: () => ({
      messages: [],
      thoughts: [],
      hotels: [
        {
          id: "hotel-spb-1",
          name: "Отель Невский",
          city: "Санкт-Петербург",
          stars: 4,
          area: "Центр",
          area_type: "center",
          rating: 9.0,
          reviews_count: 50,
          image_urls: [],
          match_score_pct: 95,
          tags: ["Центр"],
          min_price_per_night_rub: 6200,
          receipt: {
            nights: 2,
            price_per_night_rub: 6200,
            base_accommodation_cost_rub: 12400,
            pet_deposit_rub: 0,
            resort_tax_rub: 200,
            total_rub: 12600,
            is_free_cancellation: true,
          },
        },
      ],
      chips: ["С завтраком"],
      transportSummary: null,
      isStreaming: false,
      isThinking: false,
      sendMessage: vi.fn(),
      stopStream: vi.fn(),
    }),
  };
});

describe("HomePage Mobile & Deep Link Integration", () => {
  it("renders mobile floating bar and share button when hotels are present", () => {
    render(<HomePage />);

    const floatingBar = screen.getByTestId("mobile-floating-bar");
    expect(floatingBar).toBeDefined();
    expect(screen.getByText(/Найдено 1 вариант от 6 200 ₽/i)).toBeDefined();

    // Check share trip buttons (in header and canvas)
    const shareButtons = screen.getAllByTitle("Поделиться готовой поездкой");
    expect(shareButtons.length).toBeGreaterThan(0);
  });
});
