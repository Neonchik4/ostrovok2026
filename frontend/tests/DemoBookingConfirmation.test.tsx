import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import { Hotel } from "@/entities/hotel";
import {
  buildBookingDetailsText,
  DemoBookingConfirmation,
  generateDemoOrderNumber,
  getDemoBookingDates,
} from "@/features/booking-confirmation";

const baseHotel: Hotel = {
  id: "sochi/grand-marine",
  name: "Гранд Отель Морской",
  city: "Сочи",
  stars: 4,
  area: "Центр",
  area_type: "city",
  rating: 4.6,
  reviews_count: 512,
  image_urls: [],
  match_score_pct: 91,
  tags: ["у пляжа"],
  min_price_per_night_rub: 8500,
  suitable_room: {
    name: "Делюкс с балконом",
    price_per_night_rub: 8500,
  },
  receipt: {
    nights: 3,
    price_per_night_rub: 8500,
    base_accommodation_cost_rub: 25500,
    pet_deposit_rub: 0,
    resort_tax_rub: 300,
    total_rub: 25800,
    is_free_cancellation: true,
    transfer_note: "Трансфер включён в стоимость",
  },
  checkout_url:
    "https://ostrovok.ru/hotel/russia/sochi/grand_marine/?dates=2026-11-03-2026-11-06&guests=2",
};

describe("generateDemoOrderNumber", () => {
  it("is deterministic for the same hotel id", () => {
    expect(generateDemoOrderNumber("sochi/grand-marine")).toBe(
      generateDemoOrderNumber("sochi/grand-marine")
    );
  });

  it("follows the OST-DEMO-2026-XXXX format with a 4-digit code", () => {
    expect(generateDemoOrderNumber("sochi/grand-marine")).toMatch(
      /^OST-DEMO-2026-\d{4}$/
    );
  });

  it("differs between different hotels", () => {
    expect(generateDemoOrderNumber("sochi/grand-marine")).not.toBe(
      generateDemoOrderNumber("kazan/river-house")
    );
  });
});

describe("getDemoBookingDates", () => {
  it("sets check-in 7 days ahead and check-out after the given nights", () => {
    const dates = getDemoBookingDates(3, new Date(2026, 9, 27));
    expect(dates.checkinIso).toBe("2026-11-03");
    expect(dates.checkoutIso).toBe("2026-11-06");
    expect(dates.checkinLabel).toBe("3 ноя 2026");
    expect(dates.checkoutLabel).toBe("6 ноя 2026");
  });

  it("falls back to the default 2 nights for zero and clamps negatives to 1 night", () => {
    expect(getDemoBookingDates(0, new Date(2026, 9, 27)).checkoutIso).toBe("2026-11-05");
    expect(getDemoBookingDates(-5, new Date(2026, 9, 27)).checkoutIso).toBe("2026-11-04");
  });
});

describe("buildBookingDetailsText", () => {
  it("includes order number, stay composition and the real checkout link", () => {
    const text = buildBookingDetailsText({
      orderNumber: "OST-DEMO-2026-1234",
      hotelName: "Гранд Отель Морской",
      city: "Сочи",
      roomName: "Делюкс с балконом",
      checkinLabel: "3 ноя 2026",
      checkoutLabel: "6 ноя 2026",
      guests: 2,
      totalLabel: "25 800 ₽",
      checkoutUrl: "https://ostrovok.ru/hotel/russia/sochi/grand_marine/",
    });

    expect(text).toContain("OST-DEMO-2026-1234");
    expect(text).toContain("Гранд Отель Морской");
    expect(text).toContain("Делюкс с балконом");
    expect(text).toContain("3 ноя 2026");
    expect(text).toContain("25 800 ₽");
    expect(text).toContain("https://ostrovok.ru/hotel/russia/sochi/grand_marine/");
    expect(text).toContain("демо");
  });
});

describe("DemoBookingConfirmation modal", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <DemoBookingConfirmation
        hotel={baseHotel}
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the deterministic order number, stay composition and demo disclaimer", () => {
    render(
      <DemoBookingConfirmation hotel={baseHotel} open={true} onOpenChange={vi.fn()} />
    );

    const orderNumber = generateDemoOrderNumber(baseHotel.id);
    expect(screen.getByText(orderNumber)).toBeInTheDocument();
    expect(screen.getByText("Гранд Отель Морской")).toBeInTheDocument();
    expect(screen.getByText(/Делюкс с балконом/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /демо-бронь подтверждена/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/учебная демо-бронь/i)).toBeInTheDocument();
    expect(screen.getByText(/25 800/)).toBeInTheDocument();
    expect(screen.getByText(/деньги не списываются/i)).toBeInTheDocument();
  });

  it("links the real checkout button to the hotel checkout_url", () => {
    render(
      <DemoBookingConfirmation hotel={baseHotel} open={true} onOpenChange={vi.fn()} />
    );

    const link = screen.getByRole("link", { name: /реальный чекаут/i });
    expect(link).toHaveAttribute("href", baseHotel.checkout_url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to the generated Ostrovok search link without checkout_url", () => {
    const hotelWithoutUrl: Hotel = { ...baseHotel, checkout_url: undefined };
    render(
      <DemoBookingConfirmation
        hotel={hotelWithoutUrl}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    const link = screen.getByRole("link", { name: /реальный чекаут/i });
    expect(link.getAttribute("href")).toContain("ostrovok.ru");
  });

  it("copies the booking details to the clipboard", async () => {
    render(
      <DemoBookingConfirmation hotel={baseHotel} open={true} onOpenChange={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Скопировать детали брони/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain(generateDemoOrderNumber(baseHotel.id));
    expect(copied).toContain("Гранд Отель Морской");
    expect(copied).toContain(baseHotel.checkout_url);
  });
});
