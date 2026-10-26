"use client";

import { Check, Filter, RotateCcw } from "lucide-react";
import React from "react";

import { Badge, Button } from "@/shared/ui";

import { ClassicSerpDatesGuests, SortOption } from "./ClassicSerpDatesGuests";
import { ClassicSerpPriceSlider } from "./ClassicSerpPriceSlider";

export interface FilterState {
  checkInDate?: string;
  checkOutDate?: string;
  guests: number;
  sort: SortOption;
  breakfast: boolean;
  pool: boolean;
  spa: boolean;
  pets: boolean;
  freeCancellation: boolean;
  category?: string;
  minStars: number | null;
  maxPrice: number | null;
}

interface ClassicSerpFiltersProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onReset: () => void;
  totalFound: number;
}

export function ClassicSerpFilters({
  filters,
  onFilterChange,
  onReset,
  totalFound,
}: ClassicSerpFiltersProps) {
  const toggleCheckbox = (key: "breakfast" | "pool" | "spa" | "pets" | "freeCancellation") => {
    onFilterChange({
      ...filters,
      [key]: !filters[key],
    });
  };

  const setStars = (stars: number | null) => {
    onFilterChange({
      ...filters,
      minStars: filters.minStars === stars ? null : stars,
    });
  };

  return (
    <aside
      aria-label="Фильтры каталога"
      className="w-72 shrink-0 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Фильтры</h3>
        </div>
        <Badge variant="outline" className="text-xs text-primary">
          {totalFound} вар.
        </Badge>
      </div>

      {/* Даты, гости и сортировка */}
      <ClassicSerpDatesGuests
        checkInDate={filters.checkInDate}
        checkOutDate={filters.checkOutDate}
        guests={filters.guests}
        sort={filters.sort}
        onDatesChange={(inD, outD) =>
          onFilterChange({ ...filters, checkInDate: inD, checkOutDate: outD })
        }
        onGuestsChange={(g) => onFilterChange({ ...filters, guests: g })}
        onSortChange={(s) => onFilterChange({ ...filters, sort: s })}
      />

      {/* Слайдер цен 100 ₽ – 100 000 ₽ */}
      <ClassicSerpPriceSlider
        maxPrice={filters.maxPrice}
        onChange={(price) => onFilterChange({ ...filters, maxPrice: price })}
      />

      {/* Звездность */}
      <div className="space-y-2 border-t border-border pt-4">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Категория отеля
        </span>
        <div className="flex gap-1.5">
          {[5, 4, 3].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setStars(star)}
              className={`flex-1 rounded-xl border py-1.5 text-xs font-bold transition-all ${
                filters.minStars === star
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {star} ★
            </button>
          ))}
        </div>
      </div>

      {/* Удобства и правила */}
      <div className="space-y-2 border-t border-border pt-4">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Удобства и правила
        </span>
        <div className="space-y-1">
          {[
            { id: "breakfast", label: "Завтрак включен", key: "breakfast" as const },
            { id: "pool", label: "Теплый бассейн", key: "pool" as const },
            { id: "spa", label: "СПА-комплекс", key: "spa" as const },
            { id: "pets", label: "Можно с питомцами", key: "pets" as const },
            { id: "freeCancellation", label: "Свободная отмена", key: "freeCancellation" as const },
          ].map((item) => {
            const isChecked = filters[item.key];
            return (
              <label
                key={item.id}
                className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary/40"
              >
                <span>{item.label}</span>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCheckbox(item.key)}
                  className="sr-only"
                />
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    isChecked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Сброс всех фильтров */}
      <div className="border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full gap-2 rounded-xl text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Сбросить все</span>
        </Button>
      </div>
    </aside>
  );
}
