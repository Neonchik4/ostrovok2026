"use client";

import { Filter } from "lucide-react";
import React, { useCallback, useEffect,useState } from "react";

import { Button } from "@/shared/ui";

interface QuickChipsProps {
  chips: string[];
  onSelectChip: (chip: string) => void;
  disabled?: boolean;
}

export function QuickChips({ chips, onSelectChip, disabled }: QuickChipsProps) {
  const [pressedChip, setPressedChip] = useState<string | null>(null);

  useEffect(() => {
    setPressedChip(null);
  }, [chips]);

  const handleClick = useCallback(
    (chip: string) => {
      if (disabled || pressedChip) return;
      setPressedChip(chip);
      onSelectChip(chip);
    },
    [disabled, pressedChip, onSelectChip]
  );

  if (!chips || chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <span className="mr-1 flex items-center gap-1 text-xs font-bold text-muted-foreground">
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
            className={`h-9 gap-1.5 rounded-full border-border px-4 text-sm font-medium shadow-sm transition-all duration-150 ${
              isPressed
                ? "scale-95 border-primary/60 bg-primary/30 text-primary"
                : "bg-card hover:border-primary/40 hover:bg-primary/20 hover:text-primary"
            }`}
          >
            <Filter className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{chip}</span>
          </Button>
        );
      })}
    </div>
  );
}
