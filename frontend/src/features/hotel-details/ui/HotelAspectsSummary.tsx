"use client";

import React from "react";
import { ReviewsSummary } from "@/entities/hotel";
import { ThumbsUp, AlertTriangle, Users } from "lucide-react";

interface HotelAspectsSummaryProps {
  summary?: ReviewsSummary;
}

const TRAVELLER_NAMES: Record<string, string> = {
  couple: "Пары",
  family: "Семьи",
  solo_travel: "Соло",
  business: "Бизнес",
  company: "Компании",
  other: "Другие",
};

export function HotelAspectsSummary({ summary }: HotelAspectsSummaryProps) {
  if (!summary) return null;

  const { positive_highlights, negative_highlights, traveller_distribution } = summary;
  const hasHighlights =
    (positive_highlights && positive_highlights.length > 0) ||
    (negative_highlights && negative_highlights.length > 0);

  if (!hasHighlights && !traveller_distribution) return null;

  return (
    <div className="space-y-4">
      {/* Плюсы по отзывам */}
      {positive_highlights && positive_highlights.length > 0 && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <div className="mb-2.5 flex items-center gap-2 text-sm font-bold text-emerald-400">
            <ThumbsUp className="h-4 w-4" />
            <span>Плюсы по отзывам гостей</span>
          </div>
          <div className="space-y-1.5">
            {positive_highlights.map((highlight, idx) => (
              <div key={idx} className="text-xs font-medium leading-relaxed text-emerald-100">
                • {highlight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Нюансы и предупреждения */}
      {negative_highlights && negative_highlights.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <div className="mb-2.5 flex items-center gap-2 text-sm font-bold text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span>Обратите внимание (из отзывов)</span>
          </div>
          <div className="space-y-1.5">
            {negative_highlights.map((highlight, idx) => (
              <div key={idx} className="text-xs font-medium leading-relaxed text-amber-100">
                • {highlight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Распределение гостей */}
      {traveller_distribution && Object.keys(traveller_distribution).length > 0 && (
        <div className="rounded-xl border border-border bg-card/60 p-3.5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>Кто чаще выбирает этот отель</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(traveller_distribution)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  <span>{TRAVELLER_NAMES[key] || key}:</span>
                  <span className="font-bold text-primary">{Math.round(val * 100)}%</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
