import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HotelDetailModal } from "@/features/hotel-details";
import { Hotel } from "@/entities/hotel";

describe("HotelDetailModal", () => {
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
    id: "hotel-polyana-1",
    name: "Гранд Отель Поляна",
    city: "Красная Поляна",
    stars: 5,
    area: "Эстосадок",
    area_type: "mountain",
    address: "ул. Ачипсинская, 16",
    rating: 4.9,
    reviews_count: 320,
    image_urls: ["https://images.unsplash.com/photo-1566073771259-6a8506099945"],
    match_score_pct: 98,
    tags: ["спа", "бассейн", "дог-френдли"],
    min_price_per_night_rub: 12000,
    reviews_summary: {
      positive_highlights: [
        "Отличная звукоизоляция в номерах",
        "Теплый открытый бассейн с видом на Кавказские горы",
      ],
      negative_highlights: [
        "Высокая стоимость парковки на территории",
      ],
      valid_reviews_count: 120,
      traveller_distribution: {
        couple: 0.45,
        family: 0.35,
        solo_travel: 0.2,
      },
    },
    reviews: [
      {
        id: 101,
        author: "Елена",
        date: "2026-08-10",
        rating: 9.8,
        plus: "Безупречная чистота, подогреваемый бассейн, тишина ночью.",
        minus: "Завтраки могли бы быть разнообразнее.",
        room: "Делюкс с панорамным видом",
        traveller_type: "couple",
      },
    ],
  };

  it("renders null when hotel is null", () => {
    const { container } = render(
      <HotelDetailModal hotel={null} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders hotel details and review highlights correctly", async () => {
    await act(async () => {
      render(<HotelDetailModal hotel={mockHotel} onClose={vi.fn()} />);
    });

    expect(screen.getByText("Гранд Отель Поляна")).toBeInTheDocument();
    expect(screen.getByText(/ул. Ачипсинская, 16/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Оценка соответствия/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/% совпадение/)).not.toBeInTheDocument();
    expect(screen.getByText("Плюсы по отзывам гостей")).toBeInTheDocument();
    expect(
      screen.getByText(/Отличная звукоизоляция в номерах/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Высокая стоимость парковки на территории/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Елена/)).toBeInTheDocument();
    expect(
      screen.getByText(/Безупречная чистота, подогреваемый бассейн/)
    ).toBeInTheDocument();
  });

  it("triggers onClose when close button is clicked", async () => {
    const handleClose = vi.fn();
    await act(async () => {
      render(<HotelDetailModal hotel={mockHotel} onClose={handleClose} />);
    });

    const closeBtn = screen.getByLabelText("Закрыть");
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not render a booking button (anti-slop)", async () => {
    await act(async () => {
      render(<HotelDetailModal hotel={mockHotel} onClose={vi.fn()} />);
    });

    expect(screen.queryByRole("button", { name: /Забронировать/i })).not.toBeInTheDocument();
  });

  it("renders compromise note banner when present in detailed hotel", async () => {
    const hotelWithCompromise: Hotel = {
      ...mockHotel,
      compromise_note: "Бюджет превышен на 1 500 ₽",
    };
    await act(async () => {
      render(<HotelDetailModal hotel={hotelWithCompromise} onClose={vi.fn()} />);
    });

    expect(screen.getByText(/Компромисс: Бюджет превышен на 1 500 ₽/)).toBeInTheDocument();
  });

  it("allows opening criteria breakdown from the score badge in modal", async () => {
    const hotelWithBreakdown: Hotel = {
      ...mockHotel,
      criteria_breakdown: [
        {
          criterion: "Бассейн",
          status: "code_verified",
          evidence: "Подогреваемый бассейн в наличии",
          is_positive: true,
        },
      ],
    };
    await act(async () => {
      render(<HotelDetailModal hotel={hotelWithBreakdown} onClose={vi.fn()} />);
    });

    const badgeBtn = screen.getByRole("button", { name: /Оценка соответствия/i });
    fireEvent.click(badgeBtn);

    expect(screen.getByRole("dialog", { name: /Обоснование соответствия отеля/i })).toBeInTheDocument();
    expect(screen.getByText("Подогреваемый бассейн в наличии")).toBeInTheDocument();
  });
});
