import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Hotel } from "@/entities/hotel";
import { ClassicSerpMap } from "@/widgets/ClassicSerp/ui/ClassicSerpMap";

const mockHotels: Hotel[] = [
  {
    id: "hotel-1",
    name: "Гранд Отель Поляна",
    city: "Красная Поляна",
    stars: 5,
    area: "Эстосадок",
    area_type: "mountains",
    rating: 9.4,
    reviews_count: 512,
    image_urls: [],
    match_score_pct: 95,
    tags: ["Бассейн", "Спа"],
    min_price_per_night_rub: 12500,
    coordinates: {
      lat: 43.6881,
      lon: 40.2612,
    },
  },
  {
    id: "hotel-2",
    name: "Отель Долина 960",
    city: "Красная Поляна",
    stars: 4,
    area: "Поляна 960",
    area_type: "mountains",
    rating: 8.9,
    reviews_count: 240,
    image_urls: [],
    match_score_pct: 88,
    tags: ["Вид на горы"],
    min_price_per_night_rub: 8900,
    coordinates: {
      lat: 43.6654,
      lon: 40.2635,
    },
  },
];

describe("ClassicSerpMap", () => {
  it("renders header with destination city and tabs", () => {
    const handleSelect = vi.fn();
    render(
      <ClassicSerpMap
        hotels={mockHotels}
        selectedHotelId={null}
        onSelectHotel={handleSelect}
      />
    );

    expect(screen.getByText("Яндекс.Карты: Красная Поляна")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Карта/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Список/i })).toBeInTheDocument();
    expect(screen.getByText("2 меток в базе")).toBeInTheDocument();
  });

  it("switches to list tab and handles hotel selection", () => {
    const handleSelect = vi.fn();
    render(
      <ClassicSerpMap
        hotels={mockHotels}
        selectedHotelId="hotel-1"
        onSelectHotel={handleSelect}
      />
    );

    const listTabButton = screen.getByRole("button", { name: /Список/i });
    fireEvent.click(listTabButton);

    expect(screen.getByText("Гранд Отель Поляна")).toBeInTheDocument();
    expect(screen.getByText("Отель Долина 960")).toBeInTheDocument();

    const secondHotel = screen.getByText("Отель Долина 960");
    fireEvent.click(secondHotel);
    expect(handleSelect).toHaveBeenCalledWith(mockHotels[1]);
  });

  it("renders link pointing to Yandex Maps", () => {
    const handleSelect = vi.fn();
    render(
      <ClassicSerpMap
        hotels={mockHotels}
        selectedHotelId="hotel-1"
        onSelectHotel={handleSelect}
      />
    );

    const yandexLink = screen.getByRole("link", { name: /Яндекс\.Карты/i });
    expect(yandexLink).toHaveAttribute("href");
    expect(yandexLink.getAttribute("href")).toContain("yandex.ru/maps");
  });
});
