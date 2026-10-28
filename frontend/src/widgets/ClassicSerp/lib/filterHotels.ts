import { Hotel } from "@/entities/hotel";

import { FilterState } from "../ui/ClassicSerpFilters";

export function filterAndSortHotels(hotels: Hotel[], filters: FilterState): Hotel[] {
  const list = hotels.filter((h) => {
    if (filters.minStars && h.stars < filters.minStars) return false;
    if (filters.maxPrice && h.min_price_per_night_rub > filters.maxPrice) return false;

    const tags = (h.tags || []).map((t) => t.toLowerCase());
    if (
      filters.breakfast &&
      !tags.some((t) => t.includes("завтрак") || t.includes("питани") || t.includes("breakfast"))
    ) {
      return false;
    }
    if (
      filters.pool &&
      !tags.some((t) => t.includes("бассейн") || t.includes("поплавать") || t.includes("pool"))
    ) {
      return false;
    }
    if (
      filters.spa &&
      !tags.some((t) => t.includes("спа") || t.includes("spa") || t.includes("саун") || t.includes("баня"))
    ) {
      return false;
    }
    if (
      filters.pets &&
      !tags.some(
        (t) =>
          t.includes("собак") ||
          t.includes("питомц") ||
          t.includes("дог") ||
          t.includes("pet") ||
          t.includes("животн")
      )
    ) {
      return false;
    }
    if (
      filters.freeCancellation &&
      !(h.receipt?.is_free_cancellation || tags.some((t) => t.includes("отмен")))
    ) {
      return false;
    }
    return true;
  });

  if (filters.sort === "price_asc") {
    list.sort((a, b) => a.min_price_per_night_rub - b.min_price_per_night_rub);
  } else if (filters.sort === "price_desc") {
    list.sort((a, b) => b.min_price_per_night_rub - a.min_price_per_night_rub);
  } else if (filters.sort === "rating") {
    list.sort((a, b) => b.rating - a.rating);
  }

  return list;
}
