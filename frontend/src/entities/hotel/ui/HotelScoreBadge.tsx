import React from "react";
import { Sparkles } from "lucide-react";

interface HotelScoreBadgeProps {
  scorePct: number;
}

export function HotelScoreBadge({ scorePct }: HotelScoreBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-extrabold text-foreground shadow-lg backdrop-blur-md md:text-sm">
      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-foreground">{scorePct}% совпадение</span>
    </div>
  );
}
