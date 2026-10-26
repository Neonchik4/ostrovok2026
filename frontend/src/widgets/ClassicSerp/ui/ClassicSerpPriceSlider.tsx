"use client";

import React from "react";

import { formatPrice } from "@/shared/lib";

interface ClassicSerpPriceSliderProps {
  maxPrice: number | null;
  onChange: (price: number | null) => void;
}

export function ClassicSerpPriceSlider({
  maxPrice,
  onChange,
}: ClassicSerpPriceSliderProps) {
  const currentVal = maxPrice ?? 100000;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (val >= 100000) {
      onChange(null);
    } else {
      onChange(val);
    }
  };

  return (
    <div className="space-y-2.5 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Бюджет / ночь
        </span>
        <span className="text-xs font-black text-foreground">
          {maxPrice ? `до ${formatPrice(maxPrice)}` : "Любой бюджет"}
        </span>
      </div>

      {/* Интерактивный слайдер 100 ₽ – 100 000 ₽ */}
      <div className="space-y-1">
        <input
          type="range"
          min="100"
          max="100000"
          step="500"
          value={currentVal}
          onChange={handleSliderChange}
          aria-label="Слайдер максимальной цены за ночь"
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>100 ₽</span>
          <span>50 000 ₽</span>
          <span>100 000 ₽+</span>
        </div>
      </div>

      {/* Быстрые пресеты */}
      <div className="grid grid-cols-3 gap-1 pt-1">
        {[
          { label: "до 5 000", val: 5000 },
          { label: "до 10 000", val: 10000 },
          { label: "Все", val: null },
        ].map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onChange(preset.val)}
            className={`rounded-lg border px-1.5 py-1 text-center text-[10px] font-semibold transition-all ${
              maxPrice === preset.val
                ? "border-primary bg-primary/20 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
