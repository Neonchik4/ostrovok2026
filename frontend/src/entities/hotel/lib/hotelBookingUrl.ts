export interface HotelBookingTarget {
  id?: string;
  name: string;
  city: string;
  master_id?: number | null;
  slug?: string | null;
}

/**
 * Формирует прямую ссылку на конкретный выбранный отель на Островке.
 * При наличии master_id и slug ведет непосредственно на страницу этого отеля.
 * При их отсутствии использует безопасный поисковый fallback без 404 ошибок.
 */
export function getOstrovokBookingUrl(hotel: HotelBookingTarget | string, city?: string): string {
  if (typeof hotel === "string") {
    const query = `${hotel} ${city || ""}`.trim();
    return `https://ostrovok.ru/hotel/russia/?q=${encodeURIComponent(query)}`;
  }

  if (hotel.master_id && hotel.slug && hotel.id) {
    const cleanSlug = hotel.slug.replace(/^\/+|\/+$/g, "");
    const cleanId = hotel.id.replace(/^\/+|\/+$/g, "");
    return `https://ostrovok.ru/hotel/${cleanSlug}/mid${hotel.master_id}/${cleanId}/`;
  }

  const query = `${hotel.name} ${hotel.city || city || ""}`.trim();
  return `https://ostrovok.ru/hotel/russia/?q=${encodeURIComponent(query)}`;
}
