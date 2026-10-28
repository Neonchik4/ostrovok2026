import type { HotelData } from "@/shared/api";

import type { SharedHotelSnapshot } from "../model/types";

export function toCompactHotelSnapshot(
  hotel: Partial<HotelData> & { id: string; name: string; city: string }
): SharedHotelSnapshot {
  return {
    id: hotel.id,
    name: hotel.name,
    city: hotel.city,
    stars: hotel.stars ?? 3,
    area: hotel.area,
    area_type: hotel.area_type,
    address: hotel.address,
    rating: hotel.rating ?? 0,
    reviews_count: hotel.reviews_count ?? 0,
    match_score_pct: hotel.match_score_pct ?? 85,
    min_price_per_night_rub: hotel.min_price_per_night_rub ?? 0,
    image_urls: (hotel.image_urls || []).slice(0, 2),
    tags: (hotel.tags || []).slice(0, 4),
    suitable_room: hotel.suitable_room,
    receipt: hotel.receipt,
    distance_to_beach_m: hotel.distance_to_beach_m,
    distance_to_ski_lift_m: hotel.distance_to_ski_lift_m,
    compromise_note: hotel.compromise_note,
    checkout_url: hotel.checkout_url,
  };
}
