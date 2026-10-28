import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HotelCanvas } from "@/widgets/HotelCanvas";
import { Hotel } from "@/entities/hotel";

describe("HotelCanvas Mode Switching (Frontend 1)", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHotels[0]),
      } as Response)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockHotels: Hotel[] = [
    {
      id: "hotel-1",
      name: "Отель Лазурный",
      city: "Сочи",
      stars: 4,
      rating: 8.8,
      reviews_count: 140,
      image_urls: ["/hotels/sea/1.jpg"],
      match_score_pct: 92,
      min_price_per_night_rub: 7500,
    },
    {
      id: "hotel-2",
      name: "Горный Рассвет",
      city: "Сочи",
      stars: 5,
      rating: 9.1,
      reviews_count: 220,
      image_urls: ["/hotels/mountains/1.jpg"],
      match_score_pct: 88,
      min_price_per_night_rub: 11000,
    },
  ];

  it("renders list mode by default with found hotels", () => {
    render(<HotelCanvas hotels={mockHotels} isStreaming={false} />);

    expect(screen.getByText("Отель Лазурный")).toBeInTheDocument();
    expect(screen.getByText("Горный Рассвет")).toBeInTheDocument();
    expect(screen.getByText(/Найдено 2 отеля/)).toBeInTheDocument();
    // No detail view yet
    expect(screen.queryByTestId("hotel-detail-view")).not.toBeInTheDocument();
    // Modal is completely absent
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("switches to detail mode when a hotel is selected and back to list mode on back button", async () => {
    render(<HotelCanvas hotels={mockHotels} isStreaming={false} />);

    // Click on the first hotel card
    const firstHotel = screen.getByText("Отель Лазурный");
    await act(async () => {
      fireEvent.click(firstHotel);
    });

    // Detail mode is rendered inline
    expect(screen.getByTestId("hotel-detail-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Назад к списку/i })).toBeInTheDocument();
    // Still no modal dialog
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Click back button
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Назад к списку/i }));
    });

    // Back to list mode
    expect(screen.queryByTestId("hotel-detail-view")).not.toBeInTheDocument();
    expect(screen.getByText("Отель Лазурный")).toBeInTheDocument();
    expect(screen.getByText("Горный Рассвет")).toBeInTheDocument();
  });

  it("keeps the hotel detail view as wide as the showcase list (no size jump)", async () => {
    render(<HotelCanvas hotels={mockHotels} isStreaming={false} />);

    const maxWidthOf = (el: Element | null) => el?.className.match(/\bmax-w-\S+/)?.[0];
    const listWrapper = screen.getByText("Отель Лазурный").closest(".mx-auto");
    const listWidth = maxWidthOf(listWrapper);
    expect(listWidth).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByText("Отель Лазурный"));
    });

    expect(maxWidthOf(screen.getByTestId("hotel-detail-view"))).toBe(listWidth);
  });
});
