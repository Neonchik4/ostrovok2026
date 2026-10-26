import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Hotel } from "@/entities/hotel";
import { HotelCanvas } from "@/widgets/HotelCanvas";

describe("HotelCanvas (Inline Hotel Detail View without Modal)", () => {
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
    checkout_url: "https://ostrovok.ru/hotel/russia/krasnaya_polyana/grand_hotel_polyana/?dates=2026-11-10-2026-11-12&guests=2",
    suitable_room: {
      name: "Делюкс с видом на горы",
      price_per_night_rub: 12000,
      bed_setup: "1 King Size",
      area_sqm: 45,
    },
    receipt: {
      nights: 2,
      price_per_night_rub: 12000,
      base_accommodation_cost_rub: 24000,
      pet_deposit_rub: 2000,
      resort_tax_rub: 200,
      total_rub: 26200,
      is_free_cancellation: true,
      cancellation_deadline: "Бесплатная отмена за 48 ч до заезда",
    },
  };

  it("renders empty state when hotels list is empty", () => {
    render(<HotelCanvas hotels={[]} isStreaming={false} />);
    expect(screen.getByText("Здесь появятся найденные отели")).toBeInTheDocument();
  });

  it("renders hotel cards in grid mode", () => {
    render(<HotelCanvas hotels={[mockHotel]} isStreaming={false} />);
    expect(screen.getByText("Гранд Отель Поляна")).toBeInTheDocument();
    expect(screen.getByText("Подробнее")).toBeInTheDocument();
    expect(screen.getByText("Витрина отелей")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens inline detail view inside canvas without opening modal dialog", async () => {
    render(<HotelCanvas hotels={[mockHotel]} isStreaming={false} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Подробнее"));
    });

    expect(screen.getByText("Детали отеля")).toBeInTheDocument();
    expect(screen.getByText("Назад к отелям")).toBeInTheDocument();
    const bookLink = screen.getByRole("link", { name: /Забронировать/i });
    expect(bookLink).toHaveAttribute("href", mockHotel.checkout_url);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns to grid view when clicking back button", async () => {
    render(<HotelCanvas hotels={[mockHotel]} isStreaming={false} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Подробнее"));
    });
    expect(screen.getByText("Назад к отелям")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Назад к отелям"));
    });

    expect(screen.getByText("Витрина отелей")).toBeInTheDocument();
    expect(screen.getByText("Подробнее")).toBeInTheDocument();
  });
});
