export interface BookingDetailsInput {
  orderNumber: string;
  hotelName: string;
  city: string;
  roomName: string;
  checkinLabel: string;
  checkoutLabel: string;
  guests: number;
  totalLabel: string;
  checkoutUrl: string;
  postBookingRequests?: string[];
}

/**
 * Собирает текстовое описание демо-брони для буфера обмена и шаринга (Issue #47).
 * Честная формулировка: явно указано, что бронь учебная и деньги не списываются.
 */
export function buildBookingDetailsText(input: BookingDetailsInput): string {
  const lines = [
    `Демо-бронь ${input.orderNumber}`,
    `Отель: ${input.hotelName} (${input.city})`,
    `Номер: ${input.roomName}`,
    `Заезд: ${input.checkinLabel}, заселение с 14:00`,
    `Выезд: ${input.checkoutLabel}, до 12:00`,
    `Гости: ${input.guests}`,
    `Итого: ${input.totalLabel} (демо-бронь, без списания средств)`,
  ];

  if (input.postBookingRequests && input.postBookingRequests.length > 0) {
    lines.push(`Дополнительные услуги: ${input.postBookingRequests.join(", ")}`);
  }

  lines.push(`Реальный чекаут на Ostrovok.ru: ${input.checkoutUrl}`);

  return lines.join("\n");
}
