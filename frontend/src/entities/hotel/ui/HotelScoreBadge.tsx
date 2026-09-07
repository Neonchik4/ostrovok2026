import React from "react";
import { Badge } from "@/shared/ui";
import { Sparkles } from "lucide-react";

interface HotelScoreBadgeProps {
  scorePct: number;
}

export function HotelScoreBadge({ scorePct }: HotelScoreBadgeProps) {
  return (
    <Badge variant="accent" className="flex items-center gap-1.5 px-3 py-1 text-xs md:text-sm font-bold shadow-md rounded-lg">
      <Sparkles className="w-4 h-4" />
      <span>{scorePct}% совпадение</span>
    </Badge>
  );
}
