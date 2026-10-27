"use client";

import { ChevronDown } from "lucide-react";
import React, { useEffect, useRef } from "react";

import { Badge, Button } from "@/shared/ui";

import { MobileBottomSheetProps } from "../model/types";

export function MobileBottomSheet({
  isOpen,
  onClose,
  title = "Найденные варианты",
  badgeText,
  children,
}: MobileBottomSheetProps) {
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current !== null) {
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      if (deltaY > 60) {
        onClose();
      }
      touchStartY.current = null;
    }
  };

  return (
    <>
      {/* Затемненный фон-бэкдроп */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Закрыть шторку"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Enter") onClose();
        }}
        className={`fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Выезжающая шторка */}
      <div
        data-testid="mobile-bottom-sheet"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Индикатор свайпа (Drag Handle) */}
        <div className="flex h-7 w-full cursor-grab items-center justify-center pt-2.5">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Шапка шторки */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/80 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            {badgeText && (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
              >
                {badgeText}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Закрыть"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Тело шторки */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </>
  );
}
