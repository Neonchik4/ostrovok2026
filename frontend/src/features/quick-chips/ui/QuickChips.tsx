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
    <div className="flex flex-wrap items-center gap-2 py-3">
      <span className="text-xs font-bold text-muted-foreground mr-1">Уточнения:</span>
      {chips.map((chip, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelectChip(chip)}
          className="h-9 text-sm font-medium rounded-full bg-card hover:bg-primary/20 hover:text-primary hover:border-primary/40 transition-all border-border px-4 gap-1.5 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 text-primary" />
          <span>{chip}</span>
        </Button>
      ))}
    </div>
  );
}
