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
    suitable_room: hotel.suitable_room
      ? {
          name: hotel.suitable_room.name,
          price_per_night_rub: hotel.suitable_room.price_per_night_rub,
          bed_setup: hotel.suitable_room.bed_setup,
          area_sqm: hotel.suitable_room.area_sqm,
          view: hotel.suitable_room.view,
          has_balcony: hotel.suitable_room.has_balcony,
        }
      : undefined,
    receipt: hotel.receipt
      ? {
          nights: hotel.receipt.nights,
          price_per_night_rub: hotel.receipt.price_per_night_rub,
          base_cost_rub: hotel.receipt.base_accommodation_cost_rub,
          base_accommodation_cost_rub: hotel.receipt.base_accommodation_cost_rub,
          pet_deposit_rub: hotel.receipt.pet_deposit_rub,
          resort_tax_rub: hotel.receipt.resort_tax_rub,
          transfer_cost_rub: hotel.receipt.transfer_cost_rub,
          flight_ticket_rub: hotel.receipt.flight_ticket_rub,
          train_ticket_rub: hotel.receipt.train_ticket_rub,
          transport_ticket_rub: hotel.receipt.transport_ticket_rub,
          ticket_price_per_person_rub: hotel.receipt.ticket_price_per_person_rub,
          tickets_count: hotel.receipt.tickets_count,
          transport_type: hotel.receipt.transport_type,
          transport_name: hotel.receipt.transport_name,
          total_rub: hotel.receipt.total_rub,
          total_with_transport_rub: hotel.receipt.total_with_transport_rub,
          is_free_cancellation: hotel.receipt.is_free_cancellation,
          cancellation_deadline: hotel.receipt.cancellation_deadline,
          transfer_note: hotel.receipt.transfer_note,
          arrival_warning: hotel.receipt.arrival_warning,
        }
      : undefined,
    distance_to_beach_m: hotel.distance_to_beach_m,
    distance_to_ski_lift_m: hotel.distance_to_ski_lift_m,
    compromise_note: hotel.compromise_note,
    checkout_url: hotel.checkout_url,
  };
}
