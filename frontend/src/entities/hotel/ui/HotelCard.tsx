import { AlertCircle, CheckCircle2, MapPin, Star } from "lucide-react";
import React from "react";

import { formatPrice } from "@/shared/lib";
import { Badge, Button, Card } from "@/shared/ui";

import { Hotel } from "../model/types";
import { HotelReceiptPreview } from "./HotelReceiptPreview";
import { HotelScoreBadge } from "./HotelScoreBadge";

interface HotelCardProps {
  hotel: Hotel;
  onSelect?: (hotel: Hotel) => void;
}

export function HotelCard({ hotel, onSelect }: HotelCardProps) {
  const fallbackCategory = ["mountains", "sea", "center", "nature"].includes(hotel.area_type)
    ? hotel.area_type
    : "center";
  const fallbackIndex = ((hotel.id.charCodeAt(0) || 1) % 5) + 1;
  const fallbackUrl = `/hotels/${fallbackCategory}/${fallbackIndex}.jpg`;

  const [imgSrc, setImgSrc] = React.useState<string>(hotel.image_urls?.[0] || fallbackUrl);

  React.useEffect(() => {
    setImgSrc(hotel.image_urls?.[0] || fallbackUrl);
  }, [hotel.id, hotel.image_urls, fallbackUrl]);

  return (
    <Card className="relative flex flex-col justify-between rounded-2xl border-border bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-2xl">
      <div>
        {/* Фотография отеля и бейджи */}
        <div className="relative h-56 w-full">
          <div
            onClick={() => onSelect?.(hotel)}
            className={`h-full w-full overflow-hidden rounded-t-2xl bg-muted ${onSelect ? "cursor-pointer" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={hotel.name}
              onError={() => {
                if (imgSrc !== fallbackUrl) {
                  setImgSrc(fallbackUrl);
                }
              }}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              loading="lazy"
            />
          </div>
          <div className="absolute right-3.5 top-3.5 z-30">
            <HotelScoreBadge
              scorePct={hotel.match_score_pct}
              criteriaBreakdown={hotel.criteria_breakdown}
            />
          </div>
          <div className="absolute bottom-3.5 left-3.5 z-10 flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/85 px-3 py-1.5 text-sm font-semibold shadow-md backdrop-blur-md">
            <Star className="h-4 w-4 fill-rating text-rating" />
            <span className="font-bold text-foreground">{hotel.rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({hotel.reviews_count})</span>
          </div>
        </div>

        {/* Контент карточки */}
        <div className="space-y-4 p-5">
          {hotel.compromise_note && (
            <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-bg/40 p-2.5 text-xs font-semibold text-warning">
              <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
              <span>Компромисс: {hotel.compromise_note}</span>
            </div>
          )}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span>
                {hotel.city}
                {hotel.area ? `, ${hotel.area}` : ""}
              </span>
              <span className="mx-1">•</span>
              <span className="font-semibold text-foreground">{hotel.stars} ★</span>
            </div>
            <h3
              onClick={() => onSelect?.(hotel)}
              className={`line-clamp-1 text-xl font-bold tracking-tight text-foreground transition-colors hover:text-primary ${
                onSelect ? "cursor-pointer" : ""
              }`}
            >
              {hotel.name}
            </h3>
          </div>

          {/* Теги отеля */}
          <div className="flex flex-wrap gap-2">
            {hotel.tags?.slice(0, 3).map((tag, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>

          {/* Рекомендованный номер */}
          {hotel.suitable_room && (
            <div className="space-y-1.5 rounded-xl border border-border/90 bg-background/60 p-3.5 text-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{hotel.suitable_room.name}</span>
              </div>
              {hotel.suitable_room.bed_setup && (
                <p className="pl-6 text-xs font-medium text-muted-foreground">
                  {hotel.suitable_room.bed_setup}
                  {hotel.suitable_room.area_sqm ? ` • ${hotel.suitable_room.area_sqm} м²` : ""}
                </p>
              )}
            </div>
          )}

          {/* Детализированный чек */}
          <HotelReceiptPreview receipt={hotel.receipt} />
        </div>
      </div>

      {/* Футер карточки с ценой и кнопкой */}
      <div className="mt-2 flex items-center justify-between border-t border-border p-5 pt-3">
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            от
          </span>
          <div className="text-2xl font-black text-foreground">
            {formatPrice(hotel.min_price_per_night_rub)}
            <span className="text-sm font-normal text-muted-foreground"> / ночь</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSelect && (
            <Button
              variant="outline"
              onClick={() => onSelect(hotel)}
              className="h-11 rounded-xl border-border bg-card/60 px-4 text-sm font-semibold hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              Подробнее
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
