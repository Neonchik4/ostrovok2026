"use client";

import React from "react";
import { Button } from "@/shared/ui";
import { Plus } from "lucide-react";

interface QuickChipsProps {
  chips: string[];
  onSelectChip: (chip: string) => void;
  disabled?: boolean;
}

export function QuickChips({ chips, onSelectChip, disabled }: QuickChipsProps) {
  if (!chips || chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2">
      <span className="text-[11px] text-muted-foreground mr-1">Быстрые фильтры:</span>
      {chips.map((chip, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelectChip(chip)}
          className="h-7 text-xs rounded-full bg-card hover:bg-primary/15 hover:text-primary hover:border-primary/40 transition-colors border-border px-3 gap-1"
        >
          <Plus className="h-3 w-3 text-primary" />
          <span>{chip}</span>
        </Button>
      ))}
    </div>
  );
}
