"use client";

import React, { useState } from "react";
import { ReviewItem } from "@/entities/hotel";
import { Star, MessageSquare } from "lucide-react";
import { Button } from "@/shared/ui";

interface HotelReviewsListProps {
  reviews?: ReviewItem[];
}

export function HotelReviewsList({ reviews }: HotelReviewsListProps) {
  const [displayCount, setDisplayCount] = useState(4);

  if (!reviews || reviews.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-5 text-center text-sm text-muted-foreground">
        Отзывы для этого отеля подгружаются...
      </div>
    );
  }

  const visibleReviews = reviews.slice(0, displayCount);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span>Проверенные отзывы гостей ({reviews.length})</span>
        </div>
      </div>

      <div className="space-y-3">
        {visibleReviews.map((rev) => (
          <div
            key={rev.id}
            className="space-y-2 rounded-xl border border-border bg-background/60 p-4 text-xs shadow-sm transition-colors hover:border-primary/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{rev.author || "Гость"}</span>
                {rev.room && (
                  <span className="line-clamp-1 max-w-[200px] text-[11px] text-muted-foreground">
                    • {rev.room}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 font-bold text-rating">
                <Star className="h-3 w-3 fill-rating" />
                <span>{rev.rating}</span>
              </div>
            </div>

            {rev.plus && rev.plus !== "-" && (
              <div className="rounded-lg bg-success-bg p-2.5 leading-relaxed text-success">
                <strong className="text-success">Плюсы: </strong>
                {rev.plus}
              </div>
            )}

            {rev.minus && rev.minus !== "-" && (
              <div className="rounded-lg bg-secondary/70 p-2.5 leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Минусы: </strong>
                {rev.minus}
              </div>
            )}
          </div>
        ))}
      </div>

      {reviews.length > displayCount && (
        <div className="pt-1 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDisplayCount((c) => c + 6)}
            className="rounded-xl border-border bg-card text-xs font-semibold text-primary hover:bg-primary/10"
          >
            Показать еще отзывы ({reviews.length - displayCount})
          </Button>
        </div>
      )}
    </div>
  );
}
