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

  it("includes optional post-booking requests in the details text", () => {
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
      postBookingRequests: ["Ранний заезд / поздний выезд", "Проживание с питомцем"],
    });

    expect(text).toContain("Дополнительные услуги: Ранний заезд / поздний выезд, Проживание с питомцем");
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

  it("renders post-booking actions and displays feedback on user interaction", async () => {
    render(
      <DemoBookingConfirmation hotel={baseHotel} open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.getByText("Сервисы к поездке")).toBeInTheDocument();
    expect(screen.getByText("Ранний заезд / поздний выезд")).toBeInTheDocument();
    expect(screen.getByText("Проживание с питомцем")).toBeInTheDocument();
    expect(screen.getByText("Трансфер в отель")).toBeInTheDocument();

    const earlyBtn = screen.getByTestId("post-booking-early-checkin");
    const petBtn = screen.getByTestId("post-booking-pet");
    const transferBtn = screen.getByTestId("post-booking-transfer");

    expect(earlyBtn).toHaveTextContent("Запросить");
    expect(petBtn).toHaveTextContent("Добавить питомца");
    expect(transferBtn).toHaveTextContent("Заказать трансфер");

    // Click early check-in
    fireEvent.click(earlyBtn);
    expect(earlyBtn).toHaveTextContent("Запрос отправлен");
    expect(screen.getByTestId("early-checkin-feedback")).toHaveTextContent(
      "Запрос на ранний заезд или поздний выезд передан администратору отеля."
    );
    expect(screen.getByText("Выбрано услуг: 1")).toBeInTheDocument();

    // Click pet
    fireEvent.click(petBtn);
    expect(petBtn).toHaveTextContent("Питомец добавлен");
    expect(screen.getByTestId("pet-feedback")).toHaveTextContent(
      "Проживание с домашним животным добавлено в заявку на бронирование."
    );
    expect(screen.getByText("Выбрано услуг: 2")).toBeInTheDocument();

    // Click transfer
    fireEvent.click(transferBtn);
    expect(transferBtn).toHaveTextContent("Трансфер заказан");
    expect(screen.getByTestId("transfer-feedback")).toHaveTextContent(
      "Заявка на встречу принята. Служба трансфера свяжется перед заездом."
    );
    expect(screen.getByText("Выбрано услуг: 3")).toBeInTheDocument();

    // Toggle off pet
    fireEvent.click(petBtn);
    expect(petBtn).toHaveTextContent("Добавить питомца");
    expect(screen.queryByTestId("pet-feedback")).not.toBeInTheDocument();
    expect(screen.getByText("Выбрано услуг: 2")).toBeInTheDocument();

    // Copy to clipboard with active services
    fireEvent.click(screen.getByRole("button", { name: /Скопировать детали брони/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("Дополнительные услуги: Ранний заезд / поздний выезд, Трансфер в отель");
  });

  it("formats guests count with Russian pluralization rules", () => {
    const { rerender } = render(
      <DemoBookingConfirmation hotel={baseHotel} open={true} onOpenChange={vi.fn()} guests={1} />
    );
    expect(screen.getByText("1 гость")).toBeInTheDocument();

    rerender(
      <DemoBookingConfirmation hotel={baseHotel} open={true} onOpenChange={vi.fn()} guests={2} />
    );
    expect(screen.getByText("2 гостя")).toBeInTheDocument();

    rerender(
      <DemoBookingConfirmation hotel={baseHotel} open={true} onOpenChange={vi.fn()} guests={5} />
    );
    expect(screen.getByText("5 гостей")).toBeInTheDocument();
  });

  it("derives guests count from hotel receipt tickets_count when guests prop is omitted", () => {
    const hotelWithTickets = {
      ...baseHotel,
      receipt: {
        ...baseHotel.receipt!,
        tickets_count: 3,
      },
    };

    render(
      <DemoBookingConfirmation hotel={hotelWithTickets} open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText("3 гостя")).toBeInTheDocument();
  });

  it("sets proper aria-pressed attributes on post-booking toggle buttons", () => {
    render(
      <DemoBookingConfirmation hotel={baseHotel} open={true} onOpenChange={vi.fn()} />
    );

    const earlyBtn = screen.getByTestId("post-booking-early-checkin");
    expect(earlyBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(earlyBtn);
    expect(earlyBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(earlyBtn);
    expect(earlyBtn).toHaveAttribute("aria-pressed", "false");
  });
});

