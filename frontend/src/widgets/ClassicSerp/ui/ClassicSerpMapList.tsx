import React from "react";

import { Hotel } from "@/entities/hotel";
import { formatPrice } from "@/shared/lib";

interface ClassicSerpMapListProps {
  hotels: Hotel[];
  selectedHotelId: string | null;
  mapError: string | null;
  onSelectHotel: (hotel: Hotel) => void;
}

export function ClassicSerpMapList({
  hotels,
  selectedHotelId,
  mapError,
  onSelectHotel,
}: ClassicSerpMapListProps) {
  return (
    <div className="h-full overflow-y-auto p-3 space-y-2.5">
      {mapError && (
        <div className="rounded-lg border border-border bg-secondary/50 p-2 text-center text-[11px] text-muted-foreground">
          {mapError}
        </div>
      )}
      {hotels.map((h, idx) => {
        const isSelected = selectedHotelId === h.id;
        return (
          <div
            key={h.id}
            onClick={() => onSelectHotel(h)}
            className={`group flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition-all duration-200 ${
              isSelected
                ? "border-primary bg-primary/20 shadow-md ring-2 ring-primary/40"
                : "border-border bg-card/90 hover:border-primary/40 hover:bg-card"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                }`}
              >
                {idx + 1}
              </div>
              <div className="min-w-0">
                <h4 className="line-clamp-1 text-xs font-bold text-foreground">
                  {h.name}
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  {h.stars}★ • {h.rating.toFixed(1)} рейтинг
                </p>
              </div>
            </div>

            <div className="text-right shrink-0 pl-2">
              <span className="block text-xs font-bold text-primary">
                {formatPrice(h.min_price_per_night_rub)}
              </span>
              <span className="text-[9px] text-muted-foreground">за ночь</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
