"use client";

import { ExternalLink, Hotel as HotelIcon, Plane, Train } from "lucide-react";
import React, { useMemo, useState } from "react";

import { Hotel } from "@/entities/hotel";
import { TransportSummaryData } from "@/shared/api";
import { formatPrice } from "@/shared/lib";

import { pluralizeRu } from "../lib/format";
import { ClassicSerpFilters, FilterState } from "./ClassicSerpFilters";
import { ClassicSerpHotelCard } from "./ClassicSerpHotelCard";
import { ClassicSerpMap } from "./ClassicSerpMap";

interface ClassicSerpProps {
  hotels: Hotel[];
  transportSummary?: TransportSummaryData | null;
  onSendQuery?: (query: string) => void;
  filters?: FilterState;
  onFilterChange?: (filters: FilterState) => void;
  highlightedHotelId?: string | null;
  onSelectHotel?: (hotel: Hotel) => void;
}

const initialFilters: FilterState = {
  sort: "match",
  breakfast: false,
  pool: false,
  spa: false,
  pets: false,
  freeCancellation: false,
  minStars: null,
  maxPrice: null,
};

export function ClassicSerp({
  hotels,
  transportSummary,
  filters: controlledFilters,
  onFilterChange: setControlledFilters,
  highlightedHotelId: controlledHighlightedId,
  onSelectHotel: externalOnSelectHotel,
}: ClassicSerpProps) {
  const [internalFilters, setInternalFilters] = useState<FilterState>(initialFilters);
  const [internalHighlightedId, setInternalHighlightedId] = useState<string | null>(null);

  const filters = controlledFilters ?? internalFilters;
  const setFilters = setControlledFilters ?? setInternalFilters;
  const highlightedHotelId = controlledHighlightedId ?? internalHighlightedId;

  // Реактивная фильтрация и сортировка
  const filteredHotels = useMemo(() => {
    const list = hotels.filter((h) => {
      if (filters.minStars && h.stars < filters.minStars) return false;
      if (filters.maxPrice && h.min_price_per_night_rub > filters.maxPrice) return false;

      const tags = (h.tags || []).map((t) => t.toLowerCase());
      if (filters.breakfast && !tags.some((t) => t.includes("завтрак") || t.includes("питани"))) {
        return false;
      }
      if (filters.pool && !tags.some((t) => t.includes("бассейн") || t.includes("поплавать"))) {
        return false;
      }
      if (filters.spa && !tags.some((t) => t.includes("спа") || t.includes("spa") || t.includes("саун"))) {
        return false;
      }
      if (filters.pets && !tags.some((t) => t.includes("собак") || t.includes("питомц") || t.includes("дог"))) {
        return false;
      }
      if (filters.freeCancellation && !tags.some((t) => t.includes("отмен"))) {
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
  }, [hotels, filters]);

  const handleReset = () => {
    setFilters(initialFilters);
  };

  const handleSelectHotel = (hotel: Hotel) => {
    if (setControlledFilters) {
      externalOnSelectHotel?.(hotel);
    } else {
      setInternalHighlightedId(hotel.id);
      externalOnSelectHotel?.(hotel);
    }
  };

  return (
    <div
      data-testid="classic-serp-container"
      className="relative flex h-full w-full flex-1 flex-wrap overflow-hidden bg-muted"
    >
      {/* Фильтры + лента на всю доступную ширину, карта прижата к правому краю */}
      <div className="flex h-full min-w-0 flex-[999_1_760px] gap-6 overflow-hidden pl-5 pr-6 pt-4">
        {/* Колонка 1: Фильтры */}
        <ClassicSerpFilters filters={filters} onFilterChange={setFilters} />

        {/* Колонка 2: Список отелей (Горизонтальные карточки) */}
        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <p className="px-1 pt-0.5 text-sm text-foreground">
            <b>{pluralizeRu(filteredHotels.length, ["отель", "отеля", "отелей"])}</b>
            <span className="text-muted-foreground">
              {hotels[0]?.city && ` · ${hotels[0].city}`}
            </span>
          </p>

          {/* Баннер транспорта (Авиа + Ж/Д) */}
          {transportSummary &&
            (transportSummary.recommended_flight || transportSummary.recommended_train) && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/85 p-3.5 shadow-md backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                  {transportSummary.recommended_flight && (
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Plane className="h-4 w-4 text-primary" />
                      <span>{transportSummary.recommended_flight.airline}</span>
                      <span className="text-primary font-bold">
                        от {formatPrice(transportSummary.recommended_flight.price_rub)}
                      </span>
                    </div>
                  )}
                  {transportSummary.recommended_train && (
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Train className="h-4 w-4 text-primary" />
                      <span>{transportSummary.recommended_train.train_number}</span>
                      <span className="text-primary font-bold">
                        от {formatPrice(transportSummary.recommended_train.price_from_rub)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {transportSummary.recommended_flight?.booking_url && (
                    <a
                      href={transportSummary.recommended_flight.booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2.5 text-xs font-semibold text-primary hover:bg-primary/25"
                    >
                      <span>Билеты</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

          {/* Список отелей */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-4 pr-1">
            {filteredHotels.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center space-y-3 rounded-2xl bg-card p-8 text-center text-muted-foreground">
                <HotelIcon className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm">Нет отелей, удовлетворяющих заданным критериям.</p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              filteredHotels.map((h) => (
                <ClassicSerpHotelCard
                  key={h.id}
                  hotel={h}
                  isHighlighted={highlightedHotelId === h.id}
                  onSelect={handleSelectHotel}
                />
              ))
            )}
          </div>
        </main>
      </div>

      {/* Колонка 3: Карта (поверх неё в углу живёт Ghost-агент) */}
      <ClassicSerpMap
        hotels={filteredHotels}
        selectedHotelId={highlightedHotelId}
        onSelectHotel={(hotel) => {
          if (setControlledFilters) {
            externalOnSelectHotel?.(hotel);
          } else {
            setInternalHighlightedId(hotel.id);
          }
        }}
      />
    </div>
  );
}
