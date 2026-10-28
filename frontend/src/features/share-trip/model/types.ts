import type { TransportSummaryData } from "@/shared/api";

export interface SharedHotelSnapshot {
  id: string;
  name: string;
  city: string;
  stars: number;
  area?: string;
  area_type?: string;
  address?: string;
  rating: number;
  reviews_count: number;
  match_score_pct: number;
  min_price_per_night_rub: number;
  image_urls: string[];
  tags?: string[];
  suitable_room?: {
    name: string;
    price_per_night_rub: number;
    bed_setup?: string;
    view?: string;
    has_balcony?: boolean;
    area_sqm?: number;
  };
  receipt?: {
    nights: number;
    price_per_night_rub: number;
    base_cost_rub?: number;
    base_accommodation_cost_rub?: number;
    pet_deposit_rub: number;
    resort_tax_rub: number;
    transfer_cost_rub?: number;
    flight_ticket_rub?: number;
    train_ticket_rub?: number;
    transport_ticket_rub?: number;
    ticket_price_per_person_rub?: number;
    tickets_count?: number;
    transport_type?: "flight" | "train";
    transport_name?: string;
    total_rub: number;
    total_with_transport_rub?: number;
    is_free_cancellation: boolean;
    cancellation_deadline?: string;
    transfer_note?: string;
    arrival_warning?: string;
  };
  distance_to_beach_m?: number;
  distance_to_ski_lift_m?: number;
  compromise_note?: string;
  checkout_url?: string;
}

export interface TripShareState {
  city?: string;
  origin_city?: string;
  depart_date?: string;
  nights?: number;
  guests?: number;
  stars?: number;
  max_price_per_night_rub?: number;
  selected_hotel_id?: string;
  pet_friendly?: boolean;
  heated_pool?: boolean;
  spa?: boolean;
  breakfast_included?: boolean;
  free_cancellation?: boolean;
  transport_preference?: "flight" | "train" | "both";
  user_message?: string;
  assistant_message?: string;
  hotels?: SharedHotelSnapshot[];
  transport_summary?: TransportSummaryData | null;
}
