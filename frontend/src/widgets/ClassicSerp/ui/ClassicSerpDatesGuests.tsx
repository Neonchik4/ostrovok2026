"use client";

import { ArrowUpDown, Calendar, Users } from "lucide-react";
import React from "react";

export type SortOption = "match" | "price_asc" | "price_desc" | "rating";

interface ClassicSerpDatesGuestsProps {
  checkInDate?: string;
  checkOutDate?: string;
  guests: number;
  sort: SortOption;
  onDatesChange: (checkIn?: string, checkOut?: string) => void;
  onGuestsChange: (guests: number) => void;
  onSortChange: (sort: SortOption) => void;
}

export function ClassicSerpDatesGuests({
  checkInDate,
  checkOutDate,
  guests,
  sort,
  onDatesChange,
  onGuestsChange,
  onSortChange,
}: ClassicSerpDatesGuestsProps) {
  return (
    <div className="space-y-3 border-b border-border pb-4">
      {/* Даты заезда и выезда */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span>Даты поездки</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="date"
            aria-label="Дата заезда"
            value={checkInDate || "2026-10-26"}
            onChange={(e) => onDatesChange(e.target.value, checkOutDate)}
            className="w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="date"
            aria-label="Дата выезда"
            value={checkOutDate || "2026-10-29"}
            onChange={(e) => onDatesChange(checkInDate, e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Количество гостей */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span>Гости</span>
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onGuestsChange(g)}
              className={`flex-1 rounded-xl border py-1.5 text-xs font-bold transition-all ${
                guests === g
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {g} {g === 1 ? "гость" : g < 5 ? "гостя" : "гостей"}
            </button>
          ))}
        </div>
      </div>

      {/* Сортировка */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
          <span>Сортировка</span>
        </label>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          aria-label="Сортировка отелей"
          className="w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
        >
          <option value="match">По соответствию (Match Score)</option>
          <option value="price_asc">Сначала дешевле</option>
          <option value="price_desc">Сначала дороже</option>
          <option value="rating">По рейтингу гостей</option>
        </select>
      </div>
    </div>
  );
}
