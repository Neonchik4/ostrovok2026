"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/shared/ui";
import { Filter } from "lucide-react";

interface QuickChipsProps {
  chips: string[];
  onSelectChip: (chip: string) => void;
  disabled?: boolean;
}

export function QuickChips({ chips, onSelectChip, disabled }: QuickChipsProps) {
  const [pressedChip, setPressedChip] = useState<string | null>(null);

  const handleClick = useCallback(
    (chip: string) => {
      if (disabled || pressedChip) return;
      // Кратная анимация "выбрано" перед отправкой
      setPressedChip(chip);
      setTimeout(() => {
        setPressedChip(null);
        onSelectChip(chip);
      }, 180);
    },
    [disabled, pressedChip, onSelectChip]
  );

  if (!chips || chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <span className="text-xs font-bold text-muted-foreground mr-1 flex items-center gap-1">
        <Filter className="h-3 w-3" />
        Уточнить поиск:
      </span>
      {chips.map((chip) => {
        const isPressed = pressedChip === chip;
        return (
          <Button
            key={chip}
            variant="outline"
            size="sm"
            disabled={disabled || !!pressedChip}
            onClick={() => handleClick(chip)}
            className={`h-9 text-sm font-medium rounded-full border-border px-4 gap-1.5 shadow-sm transition-all duration-150 ${
              isPressed
                ? "bg-primary/30 text-primary border-primary/60 scale-95"
                : "bg-card hover:bg-primary/20 hover:text-primary hover:border-primary/40"
            }`}
          >
            <Filter className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>{chip}</span>
          </Button>
        );
      })}
    </div>
  );
}
