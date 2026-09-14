import React from "react";
import { Badge } from "@/shared/ui";
import { Sparkles } from "lucide-react";

interface HotelScoreBadgeProps {
  scorePct: number;
}

export function HotelScoreBadge({ scorePct }: HotelScoreBadgeProps) {
  return (
    <Badge
      variant="accent"
      className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold shadow-md md:text-sm"
    >
      <Sparkles className="h-4 w-4" />
      <span>{scorePct}% совпадение</span>
    </Badge>
  );
}
