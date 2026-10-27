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
}

/**
 * Собирает текстовое описание демо-брони для буфера обмена и шаринга (Issue #47).
 * Честная формулировка: явно указано, что бронь учебная и деньги не списываются.
 */
export function buildBookingDetailsText(input: BookingDetailsInput): string {
  return [
    `Демо-бронь ${input.orderNumber}`,
    `Отель: ${input.hotelName} (${input.city})`,
    `Номер: ${input.roomName}`,
    `Заезд: ${input.checkinLabel}, заселение с 14:00`,
    `Выезд: ${input.checkoutLabel}, до 12:00`,
    `Гости: ${input.guests}`,
    `Итого: ${input.totalLabel} (демо-бронь, без списания средств)`,
    `Реальный чекаут на Ostrovok.ru: ${input.checkoutUrl}`,
  ].join("\n");
}
