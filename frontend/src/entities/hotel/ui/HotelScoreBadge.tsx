import React from "react";
import { Badge } from "@/shared/ui";
import { Sparkles } from "lucide-react";

interface HotelScoreBadgeProps {
  scorePct: number;
}

export function HotelScoreBadge({ scorePct }: HotelScoreBadgeProps) {
  return (
    <Badge variant="accent" className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold shadow-sm">
      <Sparkles className="w-3.5 h-3.5" />
      <span>{scorePct}% совпадение</span>
    </Badge>
  );
}
