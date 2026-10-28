"use client";

import { ArrowLeft, ExternalLink, Hotel as HotelIcon, Plane, Train } from "lucide-react";
import React, { useMemo, useState } from "react";

import { Hotel } from "@/entities/hotel";
import { HotelDetailView } from "@/features/hotel-details";
import { TransportSummaryData } from "@/shared/api";
import { formatPrice } from "@/shared/lib";

import { filterAndSortHotels } from "../lib/filterHotels";
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
  const [selectedDetailHotel, setSelectedDetailHotel] = useState<Hotel | null>(null);

  const filters = controlledFilters ?? internalFilters;
  const setFilters = setControlledFilters ?? setInternalFilters;
  const highlightedHotelId = controlledHighlightedId ?? internalHighlightedId;

  // Реактивная фильтрация и сортировка
  const filteredHotels = useMemo(
    () => filterAndSortHotels(hotels, filters),
    [hotels, filters]
  );

  const handleReset = () => {
    setFilters(initialFilters);
  };

  const handleSelectHotel = (hotel: Hotel) => {
    setSelectedDetailHotel(hotel);
    if (setControlledFilters) {
      externalOnSelectHotel?.(hotel);
    } else {
      setInternalHighlightedId(hotel.id);
      externalOnSelectHotel?.(hotel);
    }
  };

  const handleFocusOnMap = (hotel: Hotel) => {
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
        {selectedDetailHotel ? (
          <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-2.5 pr-3 pb-8 hotel-canvas-scroll">
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setSelectedDetailHotel(null)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-card/80"
                >
                  <ArrowLeft className="h-4 w-4 text-primary" />
                  <span>Назад к списку отелей</span>
                </button>
              </div>
              <HotelDetailView
                hotel={selectedDetailHotel}
                transport={transportSummary}
                onBack={() => setSelectedDetailHotel(null)}
              />
            </div>
          </main>
        ) : (
          <>
            {/* Колонка 1: Фильтры */}
            <ClassicSerpFilters filters={filters} onFilterChange={setFilters} />

            {/* Колонка 2: Список отелей */}
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
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-2.5 pr-3 pb-8 hotel-canvas-scroll">
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
                      onFocusOnMap={handleFocusOnMap}
                    />
                  ))
                )}
              </div>
            </main>
          </>
        )}
      </div>

      {/* Колонка 3: Карта (поверх неё в углу живёт Ghost-агент) */}
      <ClassicSerpMap
        hotels={filteredHotels}
        selectedHotelId={highlightedHotelId}
        onSelectHotel={(hotel) => {
          setSelectedDetailHotel(hotel);
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
