import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HotelReceiptPreview } from "@/entities/hotel/ui/HotelReceiptPreview";

describe("HotelReceiptPreview", () => {
  const baseReceipt = {
    nights: 1,
    price_per_night_rub: 5000,
    base_accommodation_cost_rub: 5000,
    pet_deposit_rub: 0,
    resort_tax_rub: 100,
    total_rub: 5100,
    is_free_cancellation: true,
  };

  it("renders null when receipt is undefined", () => {
    const { container } = render(<HotelReceiptPreview receipt={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders singular 'ночь' when nights equals 1", () => {
    render(<HotelReceiptPreview receipt={baseReceipt} />);
    expect(screen.getByText(/Детализация стоимости \(1 ночь\):/)).toBeInTheDocument();
  });

  it("renders plural 'ночи' when nights is greater than 1", () => {
    render(
      <HotelReceiptPreview
        receipt={{
          ...baseReceipt,
          nights: 3,
          base_accommodation_cost_rub: 15000,
          total_rub: 15100,
        }}
      />
    );
    expect(screen.getByText(/Детализация стоимости \(3 ночи\):/)).toBeInTheDocument();
  });

  it("does not render pet deposit line when pet_deposit_rub is 0", () => {
    render(<HotelReceiptPreview receipt={{ ...baseReceipt, pet_deposit_rub: 0 }} />);
    expect(screen.queryByText("Сбор за питомца:")).not.toBeInTheDocument();
  });

  it("renders pet deposit line when pet_deposit_rub is greater than 0", () => {
    render(<HotelReceiptPreview receipt={{ ...baseReceipt, pet_deposit_rub: 1500 }} />);
    expect(screen.getByText("Сбор за питомца:")).toBeInTheDocument();
    expect(screen.getByText("1 500 ₽")).toBeInTheDocument();
  });

  it("renders default cancellation text when cancellation_deadline is omitted", () => {
    render(<HotelReceiptPreview receipt={baseReceipt} />);
    expect(screen.getByText("Бесплатная отмена")).toBeInTheDocument();
  });

  it("renders custom cancellation deadline when provided", () => {
    render(
      <HotelReceiptPreview
        receipt={{
          ...baseReceipt,
          cancellation_deadline: "Бесплатная отмена до 15 мая",
        }}
      />
    );
    expect(screen.getByText("Бесплатная отмена до 15 мая")).toBeInTheDocument();
  });

  it("renders correctly formatted amounts for total, base accommodation, and resort tax", () => {
    render(
      <HotelReceiptPreview
        receipt={{
          nights: 2,
          price_per_night_rub: 10000,
          base_accommodation_cost_rub: 20000,
          pet_deposit_rub: 2000,
          resort_tax_rub: 300,
          total_rub: 22300,
          is_free_cancellation: true,
        }}
      />
    );

    expect(screen.getByText("22 300 ₽")).toBeInTheDocument();
    expect(screen.getByText("20 000 ₽")).toBeInTheDocument();
    expect(screen.getByText("300 ₽")).toBeInTheDocument();
  });
});
