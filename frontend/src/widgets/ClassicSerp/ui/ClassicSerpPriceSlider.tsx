"use client";

import React from "react";

import { formatPrice } from "@/shared/lib";

interface ClassicSerpPriceSliderProps {
  maxPrice: number | null;
  onChange: (price: number | null) => void;
}

/** Верхняя граница шкалы: на ней фильтр по цене снимается («50 000+ ₽»). */
const PRICE_CAP = 50000;

export function ClassicSerpPriceSlider({ maxPrice, onChange }: ClassicSerpPriceSliderProps) {
  const currentVal = maxPrice ?? PRICE_CAP;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onChange(val >= PRICE_CAP ? null : val);
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <span className="text-[13px] font-bold text-foreground">Цена за ночь</span>
      <div className="flex overflow-hidden rounded-[10px] border border-border text-sm text-foreground">
        <span className="flex-1 border-r border-border px-3 py-[11px]">0 ₽</span>
        <span className="flex-1 px-3 py-[11px]">
          {maxPrice ? formatPrice(maxPrice) : `${formatPrice(PRICE_CAP)}+`}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max={PRICE_CAP}
        step="500"
        value={currentVal}
        onChange={handleSliderChange}
        aria-label="Максимальная цена за ночь"
        className="h-5 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}
