"use client";

import { Building2, ChevronUp } from "lucide-react";
import React from "react";

import { formatPrice } from "@/shared/lib";
import { Button } from "@/shared/ui";

import { MobileFloatingBarProps } from "../model/types";

export function MobileFloatingBar({
  hotelsCount,
  minPrice,
  onOpen,
  className = "",
}: MobileFloatingBarProps) {
  if (hotelsCount <= 0) return null;

  const pluralHotels =
    hotelsCount === 1 ? "вариант" : hotelsCount < 5 ? "варианта" : "вариантов";
  const label = minPrice
    ? `Найдено ${hotelsCount} ${pluralHotels} от ${formatPrice(minPrice)}`
    : `Найдено ${hotelsCount} ${pluralHotels}`;

  return (
    <div
      data-testid="mobile-floating-bar"
      className={`fixed bottom-4 left-4 right-4 z-40 lg:hidden ${className}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpen();
        }}
        className="flex items-center justify-between rounded-2xl border border-primary/40 bg-card/95 p-3.5 px-4 shadow-2xl backdrop-blur-md transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-xs font-bold text-foreground">
              {label}
            </span>
            <span className="block text-[11px] font-medium text-primary">
              Нажмите для просмотра подборки
            </span>
          </div>
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Развернуть подборку"
          className="h-9 w-9 rounded-xl border border-border bg-secondary/80 text-foreground"
        >
          <ChevronUp className="h-5 w-5 text-primary" />
        </Button>
      </div>
    </div>
  );
}
