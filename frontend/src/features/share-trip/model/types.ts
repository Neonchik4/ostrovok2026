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
}
