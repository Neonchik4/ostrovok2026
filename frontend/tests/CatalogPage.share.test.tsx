import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CatalogPage from "@/app/catalog/page";
import { decodeTripState, encodeTripState, TripShareState } from "@/features/share-trip";

const mockSendMessage = vi.fn();
const mockRestoreSharedTrip = vi.fn();
const mockState = vi.hoisted(() => ({ hotels: [] as unknown[], isRestoringCache: false }));

const hotel = {
  id: "hotel-1",
  name: "Гранд Отель Сочи",
  city: "Сочи",
  stars: 5,
  rating: 9.2,
  reviews_count: 310,
  image_urls: [],
  match_score_pct: 95,
  tags: ["завтрак"],
  min_price_per_night_rub: 12000,
  coordinates: { lat: 43.5855, lon: 39.7231 },
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/catalog",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/shared/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useChatStream: () => ({
      messages: [],
      hotels: mockState.hotels,
      transportSummary: null,
      thoughts: [],
      isStreaming: false,
      isRestoringCache: mockState.isRestoringCache,
      sendMessage: mockSendMessage,
      restoreSharedTrip: mockRestoreSharedTrip,
    }),
  };
});

describe("CatalogPage — кнопка «Поделиться»", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.hotels = [];
    mockState.isRestoringCache = false;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("hides the share button while the catalog is empty", () => {
    render(<CatalogPage />);
    expect(
      within(screen.getByRole("banner")).queryByRole("button", { name: /Поделиться/ })
    ).not.toBeInTheDocument();
  });

  it("copies a /catalog link with the hotel snapshot from the header", async () => {
    mockState.hotels = [hotel];
    window.history.replaceState(null, "", "/catalog");
    render(<CatalogPage />);

    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("banner")).getByRole("button", { name: /Поделиться/ })
      );
    });

    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    const url = new URL(copied);
    expect(url.pathname).toBe("/catalog");
    const state = decodeTripState(new URLSearchParams(url.hash.slice(1)).get("trip") ?? "");
    expect(state?.city).toBe("Сочи");
    expect(state?.hotels?.map((h) => h.id)).toEqual(["hotel-1"]);
  });

  it("waits for the session cache before sending the default query", () => {
    mockState.isRestoringCache = true;
    const { rerender } = render(<CatalogPage />);
    expect(mockSendMessage).not.toHaveBeenCalled();

    // Кэш поднял отели — запрос по умолчанию не нужен
    mockState.isRestoringCache = false;
    mockState.hotels = [hotel];
    rerender(<CatalogPage />);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("restores the shared trip from the link instead of the default query", () => {
    const state: TripShareState = {
      city: "Сочи",
      selected_hotel_id: "hotel-1",
      user_message: "Отели в Сочи",
      hotels: [hotel],
    };
    window.history.replaceState(null, "", `/catalog#trip=${encodeTripState(state)}`);

    render(<CatalogPage />);

    expect(mockRestoreSharedTrip).toHaveBeenCalledTimes(1);
    expect(mockRestoreSharedTrip.mock.calls[0][0].hotels[0].id).toBe("hotel-1");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
