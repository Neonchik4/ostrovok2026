import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Hotel } from "@/entities/hotel";
import { ClassicSerpMap } from "@/widgets/ClassicSerp/ui/ClassicSerpMap";

const loadYandexMapsScript = vi.fn();
vi.mock("@/widgets/ClassicSerp/lib/yandexMapsLoader", () => ({
  loadYandexMapsScript: () => loadYandexMapsScript(),
}));

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
  it("fills the column with the map and its own controls, without header and footer", () => {
    loadYandexMapsScript.mockReturnValue(new Promise(() => {}));
    render(<ClassicSerpMap hotels={mockHotels} selectedHotelId={null} onSelectHotel={vi.fn()} />);

    expect(screen.getByRole("region", { name: "Карта отелей" })).toBeInTheDocument();
    expect(screen.getByTestId("yandex-map-container")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Развернуть карту" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Приблизить" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отдалить" })).toBeInTheDocument();
    expect(screen.queryByText(/меток в базе/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Список/i })).not.toBeInTheDocument();
  });

  it("expands over the catalog under the site header and collapses back", () => {
    loadYandexMapsScript.mockReturnValue(new Promise(() => {}));
    render(<ClassicSerpMap hotels={mockHotels} selectedHotelId={null} onSelectHotel={vi.fn()} />);
    const map = screen.getByRole("region", { name: "Карта отелей" });
    expect(map).not.toHaveClass("absolute");

    fireEvent.click(screen.getByRole("button", { name: "Развернуть карту" }));
    expect(map).toHaveClass("absolute", "inset-0");
    expect(screen.queryByRole("button", { name: "Развернуть карту" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Свернуть карту" }));
    expect(map).not.toHaveClass("absolute");
    expect(screen.getByRole("button", { name: "Развернуть карту" })).toBeInTheDocument();
  });

  it("falls back to a hotel list offline and handles selection", async () => {
    loadYandexMapsScript.mockRejectedValue(new Error("offline"));
    const handleSelect = vi.fn();
    render(
      <ClassicSerpMap hotels={mockHotels} selectedHotelId="hotel-1" onSelectHotel={handleSelect} />
    );

    const secondHotel = await screen.findByText("Отель Долина 960");
    expect(screen.getByText("Гранд Отель Поляна")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Приблизить" })).not.toBeInTheDocument();

    fireEvent.click(secondHotel);
    expect(handleSelect).toHaveBeenCalledWith(mockHotels[1]);
  });
});
