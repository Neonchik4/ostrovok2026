import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HotelDetailView } from "@/features/hotel-details";
import { Hotel } from "@/entities/hotel";

describe("HotelDetailView (Frontend 1)", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHotel),
      } as Response)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockHotel: Hotel = {
    id: "hotel-krasnodar-1",
    name: "Марриотт Красдар",
    city: "Краснодар",
    stars: 5,
    area: "Центр",
    area_type: "center",
    address: "ул. Красная, 120",
    rating: 9.4,
    reviews_count: 412,
    image_urls: ["https://images.unsplash.com/photo-1566073771259-6a8506099945"],
    match_score_pct: 95,
    tags: ["бассейн", "завтрак", "спа"],
    min_price_per_night_rub: 11500,
    reviews_summary: {
      positive_highlights: ["Просторные номера с панорамными окнами", "Великолепный завтрак"],
      negative_highlights: ["Очередь на лифт в пиковые часы"],
      valid_reviews_count: 85,
    },
    reviews: [
      {
        id: 1,
        author: "Алексей",
        date: "2026-09-12",
        rating: 9.6,
        plus: "Все идеально, спа-комплекс на высшем уровне.",
        minus: "",
        room: "Делюкс",
      },
    ],
  };

  it("renders hotel details, tariff grid, logistics and reviews", async () => {
    await act(async () => {
      render(<HotelDetailView hotel={mockHotel} onBack={vi.fn()} />);
    });

    expect(screen.getByTestId("hotel-detail-view")).toBeInTheDocument();
    // Название уже крупно в шапке витрины — в самой карточке его нет
    expect(screen.queryByRole("heading", { name: "Марриотт Красдар" })).not.toBeInTheDocument();
    expect(screen.getByText(/ул. Красная, 120/)).toBeInTheDocument();
    expect(screen.queryByText(/% совпадение/)).not.toBeInTheDocument();
    expect(screen.getByText("Доступные номера и тарифы")).toBeInTheDocument();
    expect(screen.getByText("Стандартный двухместный номер")).toBeInTheDocument();
    expect(screen.getByText("Логистика и заселение")).toBeInTheDocument();
    expect(screen.getByText(/Заезд с 14:00 • Выезд до 12:00/)).toBeInTheDocument();
    expect(screen.getByText(/Великолепный завтрак/)).toBeInTheDocument();
    expect(screen.getByText("Алексей")).toBeInTheDocument();
  });

  it("has no top back/booking bar and calls onBack from the bottom bar", async () => {
    const handleBack = vi.fn();
    await act(async () => {
      render(<HotelDetailView hotel={mockHotel} onBack={handleBack} />);
    });

    expect(screen.queryByRole("button", { name: /Назад к вариантам/i })).not.toBeInTheDocument();
    const backButton = screen.getByRole("button", { name: /Назад к списку/i });
    fireEvent.click(backButton);

    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it("provides deep links to Ostrovok.ru for booking", async () => {
    await act(async () => {
      render(<HotelDetailView hotel={mockHotel} onBack={vi.fn()} />);
    });

    const bookingLinks = screen.getAllByRole("link", { name: /Забронировать на Ostrovok.ru/i });
    expect(bookingLinks).toHaveLength(1);
    expect(bookingLinks[0]).toHaveAttribute("href", expect.stringContaining("https://ostrovok.ru/hotel/russia/?q="));
    expect(bookingLinks[0]).toHaveAttribute("target", "_blank");
  });
});
