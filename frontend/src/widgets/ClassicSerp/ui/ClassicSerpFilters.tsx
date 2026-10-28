"use client";

import { Check, ChevronDown } from "lucide-react";
import React from "react";

import { cn } from "@/shared/lib/utils";

import { ClassicSerpPriceSlider } from "./ClassicSerpPriceSlider";

type SortOption = "match" | "price_asc" | "price_desc" | "rating";

export interface FilterState {
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

type AmenityKey = "breakfast" | "pool" | "spa" | "pets" | "freeCancellation";

interface ClassicSerpFiltersProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "match", label: "По совпадению" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "rating", label: "По рейтингу" },
];

/** Быстрые фильтры-чипсы над панелью: те же флаги, что и чекбоксы удобств. */
const QUICK_FILTERS: { key: AmenityKey; label: string }[] = [
  { key: "breakfast", label: "Завтрак включён" },
  { key: "pool", label: "Тёплый бассейн" },
  { key: "freeCancellation", label: "Бесплатная отмена" },
  { key: "spa", label: "СПА" },
];

const AMENITIES: { key: AmenityKey; label: string }[] = [
  { key: "breakfast", label: "Завтрак включён" },
  { key: "pool", label: "Тёплый бассейн" },
  { key: "spa", label: "СПА-комплекс" },
  { key: "pets", label: "Можно с питомцами" },
  { key: "freeCancellation", label: "Свободная отмена" },
];

export function ClassicSerpFilters({ filters, onFilterChange }: ClassicSerpFiltersProps) {
  const toggle = (key: AmenityKey) => {
    onFilterChange({ ...filters, [key]: !filters[key] });
  };

  const setStars = (stars: number) => {
    onFilterChange({ ...filters, minStars: filters.minStars === stars ? null : stars });
  };

  return (
    <aside
      aria-label="Фильтры каталога"
      className="flex max-h-full w-[266px] shrink-0 flex-col gap-[18px] self-start overflow-y-auto rounded-2xl bg-card p-4"
    >
      {/* Сортировка */}
      <div className="relative">
        <select
          value={filters.sort}
          onChange={(e) => onFilterChange({ ...filters, sort: e.target.value as SortOption })}
          aria-label="Сортировка отелей"
          className="h-11 w-full cursor-pointer appearance-none rounded-[10px] border border-border bg-card pl-3.5 pr-10 text-[15px] text-foreground focus:border-primary focus:outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" />
      </div>

      {/* Быстрые фильтры */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((chip) => {
          const isActive = filters[chip.key];
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => toggle(chip.key)}
              aria-pressed={isActive}
              className={cn(
                "rounded-full border px-3 py-[7px] text-[13px] transition-colors",
                isActive
                  ? "border-primary bg-accent font-semibold text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <ClassicSerpPriceSlider
        maxPrice={filters.maxPrice}
        onChange={(price) => onFilterChange({ ...filters, maxPrice: price })}
      />

      {/* Звездность */}
      <div className="flex flex-col gap-2.5 border-t border-border pt-4">
        <span className="text-[13px] font-bold text-foreground">Категория отеля</span>
        <div className="flex gap-1.5">
          {[5, 4, 3].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setStars(star)}
              aria-pressed={filters.minStars === star}
              className={cn(
                "h-9 flex-1 rounded-[10px] border text-[13px] font-bold transition-colors",
                filters.minStars === star
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {star} ★
            </button>
          ))}
        </div>
      </div>

      {/* Удобства и правила */}
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <span className="mb-1.5 text-[13px] font-bold text-foreground">Удобства и правила</span>
        {AMENITIES.map((item) => {
          const isChecked = filters[item.key];
          return (
            <label
              key={item.key}
              className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px] text-foreground"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(item.key)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                  isChecked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-[#c9ced6] bg-card"
                )}
              >
                {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
              </span>
              <span className={cn(isChecked && "font-semibold")}>{item.label}</span>
            </label>
          );
        })}
      </div>
    </aside>
  );
}
