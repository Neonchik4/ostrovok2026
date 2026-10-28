import { render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { encodeTripState, TripShareState } from "@/features/share-trip";

const mockSendMessage = vi.fn();
const mockRestoreSharedTrip = vi.fn();

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
      hotels: [],
      chips: [],
      transportSummary: null,
      isStreaming: false,
      isThinking: false,
      sendMessage: mockSendMessage,
      stopStream: vi.fn(),
      restoreSharedTrip: mockRestoreSharedTrip,
    }),
  };
});

describe("HomePage Shared Trip Restoration without recalculating", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  it("restores hotels and messages directly from trip token without calling sendMessage", () => {
    const tripState: TripShareState = {
      city: "Сочи",
      nights: 2,
      guests: 2,
      selected_hotel_id: "sochi-resort-1",
      user_message: "Поездка в Сочи на 2 гостей",
      assistant_message: "Вот сохраненная поездка в Сочи.",
      hotels: [
        {
          id: "sochi-resort-1",
          name: "Сочи Бриз Отель",
          city: "Сочи",
          stars: 4,
          rating: 9.1,
          reviews_count: 80,
          match_score_pct: 94,
          min_price_per_night_rub: 7500,
          image_urls: ["/hotels/sochi/1.jpg"],
          receipt: {
            nights: 2,
            price_per_night_rub: 7500,
            base_cost_rub: 15000,
            pet_deposit_rub: 0,
            resort_tax_rub: 200,
            total_rub: 15200,
            tickets_count: 2,
            is_free_cancellation: true,
          },
        },
      ],
    };

    const token = encodeTripState(tripState);
    Object.defineProperty(window, "location", {
      value: new URL(`https://ostrovok.tech/?trip=${token}`),
      writable: true,
    });

    render(<HomePage />);

    // restoreSharedTrip must be called with the saved hotels
    expect(mockRestoreSharedTrip).toHaveBeenCalledTimes(1);
    expect(mockRestoreSharedTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        hotels: expect.arrayContaining([
          expect.objectContaining({ id: "sochi-resort-1", name: "Сочи Бриз Отель" }),
        ]),
        userMessage: "Поездка в Сочи на 2 гостей",
        assistantMessage: "Вот сохраненная поездка в Сочи.",
      })
    );

    // Crucially: sendMessage MUST NOT be called (no LLM streaming or recalculation)
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
