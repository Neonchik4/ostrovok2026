"use client";

import { Hotel as HotelIcon, MapPin } from "lucide-react";
import React, { useState } from "react";

import { getOstrovokBookingUrl, Hotel } from "@/entities/hotel";
import { formatPrice } from "@/shared/lib";
import { cn } from "@/shared/lib/utils";

import { formatDistance, formatRating, pluralizeRu } from "../lib/format";

interface ClassicSerpHotelCardProps {
  hotel: Hotel;
  isHighlighted?: boolean;
  onSelect: (hotel: Hotel) => void;
  onFocusOnMap?: (hotel: Hotel) => void;
}

function hotelDetails(hotel: Hotel): string[] {
  const place = hotel.area ? `${hotel.city}, ${hotel.area}` : hotel.city;
  const details = [place];
  if (hotel.distance_to_beach_m) {
    details.push(formatDistance(hotel.distance_to_beach_m, "до моря"));
  } else if (hotel.distance_to_ski_lift_m) {
    details.push(formatDistance(hotel.distance_to_ski_lift_m, "до подъёмника"));
  }
  const hasFreeCancellation =
    hotel.receipt?.is_free_cancellation ||
    (hotel.tags || []).some((tag) => tag.toLowerCase().includes("отмен"));
  if (hasFreeCancellation) details.push("Бесплатная отмена");
  return details;
}

export function ClassicSerpHotelCard({
  hotel,
  isHighlighted = false,
  onSelect,
  onFocusOnMap,
}: ClassicSerpHotelCardProps) {
  // Только реальные фото отеля; нет или не загрузилось — пустой блок без картинки
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUrl = photoFailed ? undefined : hotel.image_urls?.[0];

  const ostrovokUrl = hotel.checkout_url || getOstrovokBookingUrl(hotel);

  return (
    <article
      onClick={() => onSelect(hotel)}
      className={cn(
        "flex w-full shrink-0 cursor-pointer gap-4 rounded-2xl bg-card p-2 transition-all",
        isHighlighted
          ? "border-2 border-primary shadow-lg ring-2 ring-primary/25"
          : "border-2 border-border/70 hover:border-primary/50 hover:shadow-md"
      )}
    >
      <div className="min-h-[176px] w-[176px] shrink-0 self-stretch overflow-hidden rounded-xl bg-accent">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={hotel.name}
            onError={() => setPhotoFailed(true)}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <HotelIcon aria-hidden="true" className="h-10 w-10" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-2 pr-2">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <span className="rounded-md bg-success px-1.5 py-px font-bold text-white">
            {formatRating(hotel.rating)}
          </span>
          <span>{pluralizeRu(hotel.reviews_count, ["оценка", "оценки", "оценок"])}</span>
        </div>

        <h3 className="text-[17px] font-bold text-foreground">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(hotel);
            }}
            className="text-left transition-colors hover:text-primary"
          >
            <span>{hotel.name}</span> <span>★{hotel.stars}</span>
          </button>
        </h3>

        <p className="text-[13px] leading-[1.4] text-muted-foreground">
          {hotelDetails(hotel).join(" · ")}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-bold leading-[1.15] text-foreground">
              {formatPrice(hotel.min_price_per_night_rub)}
            </span>
            <span className="text-[13px] text-muted-foreground">за ночь</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onFocusOnMap) {
                  onFocusOnMap(hotel);
                } else {
                  onSelect(hotel);
                }
              }}
              title="Показать отель на карте"
              className="flex h-11 items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
            >
              <MapPin className="h-4 w-4 text-primary" />
              <span>На карте</span>
            </button>

            <a
              href={ostrovokUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex h-11 shrink-0 items-center rounded-xl bg-primary px-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Выбрать номер
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
