import React from "react";
import { Card, Button, Badge } from "@/shared/ui";
import { formatPrice } from "@/shared/lib";
import { Hotel } from "../model/types";
import { HotelScoreBadge } from "./HotelScoreBadge";
import { HotelReceiptPreview } from "./HotelReceiptPreview";
import { Star, MapPin, CheckCircle2 } from "lucide-react";

interface HotelCardProps {
  hotel: Hotel;
  onBook?: (hotel: Hotel) => void;
}

export function HotelCard({ hotel, onBook }: HotelCardProps) {
  const imageUrl = hotel.image_urls?.[0] || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80";

  return (
    <Card className="overflow-hidden border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-lg flex flex-col justify-between">
      <div>
        {/* Фотография отеля и бейджи */}
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={hotel.name}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
          <div className="absolute top-3 right-3">
            <HotelScoreBadge scorePct={hotel.match_score_pct} />
          </div>
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-xs backdrop-blur-md">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">{hotel.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({hotel.reviews_count})</span>
          </div>
        </div>

        {/* Контент карточки */}
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{hotel.city}{hotel.area ? `, ${hotel.area}` : ""}</span>
              <span className="mx-1">•</span>
              <span>{hotel.stars} ★</span>
            </div>
            <h3 className="text-base font-semibold text-foreground line-clamp-1">
              {hotel.name}
            </h3>
          </div>

          {/* Теги отеля */}
          <div className="flex flex-wrap gap-1.5">
            {hotel.tags?.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-[10px] py-0 px-2 bg-muted/40 border-border">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Рекомендованный номер */}
          {hotel.suitable_room && (
            <div className="rounded-md border border-border/80 bg-background/40 p-2.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-primary font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{hotel.suitable_room.name}</span>
              </div>
              {hotel.suitable_room.bed_setup && (
                <p className="text-muted-foreground text-[11px]">
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
      <div className="p-4 pt-0 border-t border-border mt-3 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-muted-foreground block">от</span>
          <div className="text-lg font-bold text-foreground">
            {formatPrice(hotel.min_price_per_night_rub)}
            <span className="text-xs font-normal text-muted-foreground"> / ночь</span>
          </div>
        </div>

        <Button
          onClick={() => onBook?.(hotel)}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          Забронировать
        </Button>
      </div>
    </Card>
  );
}
