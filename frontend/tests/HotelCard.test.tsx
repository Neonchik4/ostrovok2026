import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HotelCard, Hotel } from "@/entities/hotel";

describe("HotelCard", () => {
  const mockHotel: Hotel = {
    id: "hotel-test-1",
    name: "Гранд Отель Поляна",
    city: "Красная Поляна",
    stars: 5,
    area: "Эстосадок",
    area_type: "mountain",
    rating: 4.9,
    reviews_count: 320,
    image_urls: ["https://images.unsplash.com/photo-1566073771259-6a8506099945"],
    match_score_pct: 98,
    tags: ["спа", "бассейн", "дог-френдли"],
    min_price_per_night_rub: 12000,
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

  it("renders hotel information correctly", () => {
    render(<HotelCard hotel={mockHotel} />);

    expect(screen.getByText("Гранд Отель Поляна")).toBeInTheDocument();
    expect(screen.getByText(/Красная Поляна/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Оценка соответствия/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/% совпадение/)).not.toBeInTheDocument();
    expect(screen.getByText("Делюкс с видом на горы")).toBeInTheDocument();
  });

  it("renders transparent receipt details", () => {
    render(<HotelCard hotel={mockHotel} />);

    expect(screen.getByText(/Детализация стоимости/)).toBeInTheDocument();
    expect(screen.getByText(/Бесплатная отмена за 48 ч до заезда/)).toBeInTheDocument();
  });

  it("does not render a booking button (anti-slop)", () => {
    render(<HotelCard hotel={mockHotel} />);

    expect(screen.queryByRole("button", { name: /Забронировать/i })).not.toBeInTheDocument();
  });

  it("renders smart relaxation compromise note when present", () => {
    const relaxedHotel: Hotel = {
      ...mockHotel,
      compromise_note: "Бюджет превышен на 2 000 ₽",
    };
    render(<HotelCard hotel={relaxedHotel} />);

    expect(screen.getByText(/Компромисс: Бюджет превышен на 2 000 ₽/)).toBeInTheDocument();
  });

  it("supports clicking score badge to view criteria breakdown", () => {
    const hotelWithBreakdown: Hotel = {
      ...mockHotel,
      criteria_breakdown: [
        {
          criterion: "Питомцы",
          status: "code_verified",
          evidence: "Проживание с питомцами разрешено",
          is_positive: true,
        },
      ],
    };
    render(<HotelCard hotel={hotelWithBreakdown} />);

    const badgeBtn = screen.getByRole("button", { name: /Оценка соответствия/i });
    expect(badgeBtn).toBeInTheDocument();

    fireEvent.click(badgeBtn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Проживание с питомцами разрешено")).toBeInTheDocument();
  });

  it("renders flight ticket option and full trip budget when present", () => {
    const hotelWithTransport: Hotel = {
      ...mockHotel,
      receipt: {
        ...mockHotel.receipt!,
        flight_ticket_rub: 5200,
        total_with_transport_rub: 31400,
      },
    };
    render(<HotelCard hotel={hotelWithTransport} />);

    expect(screen.getByText(/Билет на рейс:/)).toBeInTheDocument();
    expect(screen.getByText(/Вся поездка под ключ:/)).toBeInTheDocument();
  });

  it("renders train ticket and working Ostrovok booking link without 404", () => {
    const hotelWithTrain: Hotel = {
      ...mockHotel,
      receipt: {
        ...mockHotel.receipt!,
        train_ticket_rub: 3600,
        transport_type: "train",
        total_with_transport_rub: 29800,
      },
    };
    render(<HotelCard hotel={hotelWithTrain} />);

    expect(screen.getByText(/Ж\/Д билет:/)).toBeInTheDocument();
    expect(screen.queryByText(/Билет на рейс:/)).not.toBeInTheDocument();
    const ostrovokLink = screen.getByTitle(/Забронировать на Ostrovok.ru/);
    expect(ostrovokLink).toHaveAttribute(
      "href",
      expect.stringContaining("https://ostrovok.ru/hotel/russia/?q=")
    );
  });

  it("renders direct link to exact selected hotel when master_id and slug are present", () => {
    const hotelWithDirectLink: Hotel = {
      ...mockHotel,
      id: "azimut_hotel_smolenskaya_moscow",
      master_id: 8744391,
      slug: "russia/moscow",
    };
    render(<HotelCard hotel={hotelWithDirectLink} />);

    const ostrovokLink = screen.getByTitle(/Забронировать на Ostrovok.ru/);
    expect(ostrovokLink).toHaveAttribute(
      "href",
      "https://ostrovok.ru/hotel/russia/moscow/mid8744391/azimut_hotel_smolenskaya_moscow/"
    );
  });
});
