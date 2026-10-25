"use client";

import { ExternalLink, Hotel as HotelIcon, Plane, Train } from "lucide-react";
import React, { useMemo, useState } from "react";

import { Hotel } from "@/entities/hotel";
import { HotelDetailModal } from "@/features/hotel-details";
import { TransportSummaryData } from "@/shared/api";
import { formatPrice } from "@/shared/lib";

import { ClassicSerpFilters, FilterState } from "./ClassicSerpFilters";
import { ClassicSerpHotelCard } from "./ClassicSerpHotelCard";
import { ClassicSerpMap } from "./ClassicSerpMap";

interface ClassicSerpProps {
  hotels: Hotel[];
  transportSummary?: TransportSummaryData | null;
  onSendQuery?: (query: string) => void;
}

const initialFilters: FilterState = {
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
  onSendQuery: _onSendQuery,
}: ClassicSerpProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [highlightedHotelId, setHighlightedHotelId] = useState<string | null>(null);

  // Фильтрация на лету
  const filteredHotels = useMemo(() => {
    return hotels.filter((h) => {
      if (filters.minStars && h.stars < filters.minStars) return false;
      if (filters.maxPrice && h.min_price_per_night_rub > filters.maxPrice) return false;
      return true;
    });
  }, [hotels, filters]);

  const handleReset = () => {
    setFilters(initialFilters);
  };

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-background p-6">
      <div className="mx-auto flex h-full w-full max-w-7xl gap-6">
        {/* Колонка 1: Фильтры */}
        <ClassicSerpFilters
          filters={filters}
          onFilterChange={setFilters}
          onReset={handleReset}
          totalFound={filteredHotels.length}
        />

        {/* Колонка 2: Список отелей (Горизонтальные карточки) */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Баннер транспорта (Авиа + Ж/Д) */}
          {transportSummary && (transportSummary.recommended_flight || transportSummary.recommended_train) && (() => {
            const isTrainPref = transportSummary.preferred_mode === "train";
            const flightBlock = transportSummary.recommended_flight && (
              <div className={`flex items-center gap-2 text-xs ${isTrainPref ? "border-border md:border-l md:pl-3" : ""}`}>
                <Plane className={`h-4 w-4 ${!isTrainPref ? "text-primary" : "text-foreground"}`} />
                <span className="font-bold text-foreground">
                  {transportSummary.recommended_flight.airline}
                </span>
                <span className={!isTrainPref ? "text-primary" : "text-foreground"}>
                  от {formatPrice(transportSummary.recommended_flight.price_rub)}
                </span>
                <span className="text-muted-foreground">
                  • {transportSummary.origin_city} → {transportSummary.destination_city} (прилет ~{transportSummary.arrival_time || "13:45"})
                </span>
              </div>
            );

            const trainBlock = transportSummary.recommended_train && (
              <div className={`flex items-center gap-2 text-xs ${!isTrainPref ? "border-border md:border-l md:pl-3" : ""}`}>
                <Train className={`h-4 w-4 ${isTrainPref ? "text-primary" : "text-foreground"}`} />
                <span className="font-bold text-foreground">
                  {transportSummary.recommended_train.train_number}
                </span>
                <span className={isTrainPref ? "text-primary" : "text-foreground"}>
                  от {formatPrice(transportSummary.recommended_train.price_from_rub)}
                </span>
                <span className="text-muted-foreground">• 14:40 → 08:15</span>
              </div>
            );

            return (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/85 p-3.5 shadow-md backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-4">
                  {isTrainPref ? (
                    <>
                      {trainBlock}
                      {flightBlock}
                    </>
                  ) : (
                    <>
                      {flightBlock}
                      {trainBlock}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isTrainPref ? (
                    <>
                      {transportSummary.recommended_train && (
                        <a
                          href={transportSummary.recommended_train.booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2.5 text-xs font-semibold text-primary hover:bg-primary/25"
                        >
                          <span>Tutu.ru</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {transportSummary.recommended_flight && (
                        <a
                          href={transportSummary.recommended_flight.booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-secondary/70 px-2.5 text-xs font-semibold text-foreground hover:text-primary"
                        >
                          <span>Aviasales</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      {transportSummary.recommended_flight && (
                        <a
                          href={transportSummary.recommended_flight.booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2.5 text-xs font-semibold text-primary hover:bg-primary/25"
                        >
                          <span>Aviasales</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {transportSummary.recommended_train && (
                        <a
                          href={transportSummary.recommended_train.booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-secondary/70 px-2.5 text-xs font-semibold text-foreground hover:text-primary"
                        >
                          <span>Tutu.ru</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Список отелей */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {filteredHotels.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center space-y-3 rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-muted-foreground">
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
                  onSelect={(hotel) => setSelectedHotel(hotel)}
                />
              ))
            )}
          </div>
        </main>

        {/* Колонка 3: Карта */}
        <ClassicSerpMap
          hotels={filteredHotels}
          selectedHotelId={highlightedHotelId}
          onSelectHotel={(hotel) => {
            setHighlightedHotelId(hotel.id);
            setSelectedHotel(hotel);
          }}
        />
      </div>

      {/* Модальное окно детализации */}
      <HotelDetailModal
        hotel={selectedHotel}
        onClose={() => setSelectedHotel(null)}
      />
    </div>
  );
}
