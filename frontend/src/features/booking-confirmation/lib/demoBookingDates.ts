export interface DemoBookingDates {
  checkinIso: string;
  checkoutIso: string;
  checkinLabel: string;
  checkoutLabel: string;
}

/** Зеркалит конвенцию backend/app/services/checkout_service.py (get_default_dates). */
const DAYS_UNTIL_CHECKIN = 7;

const RU_MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

function toIsoAndLabel(date: Date): { iso: string; label: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { iso, label: `${day} ${RU_MONTHS[month]} ${year}` };
}

/**
 * Даты демо-поездки: заезд через 7 дней, выезд через указанное число ночей.
 * Локальная дата без сдвига часовых поясов, клампинг ночей 1..90 по стандартам проекта.
 */
export function getDemoBookingDates(nights: number = 2, now: Date = new Date()): DemoBookingDates {
  const safeNights = Math.max(1, Math.min(90, Math.floor(nights) || 2));
  const checkin = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_UNTIL_CHECKIN);
  const checkout = new Date(
    checkin.getFullYear(),
    checkin.getMonth(),
    checkin.getDate() + safeNights
  );
  const checkinParts = toIsoAndLabel(checkin);
  const checkoutParts = toIsoAndLabel(checkout);
  return {
    checkinIso: checkinParts.iso,
    checkoutIso: checkoutParts.iso,
    checkinLabel: checkinParts.label,
    checkoutLabel: checkoutParts.label,
  };
}
