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
    <Card className="overflow-hidden border-border bg-card rounded-2xl transition-all duration-200 hover:border-primary/50 hover:shadow-2xl flex flex-col justify-between">
      <div>
        {/* Фотография отеля и бейджи */}
        <div className="relative h-56 w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={hotel.name}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
          <div className="absolute top-3.5 right-3.5">
            <HotelScoreBadge scorePct={hotel.match_score_pct} />
          </div>
          <div className="absolute bottom-3.5 left-3.5 flex items-center gap-1.5 rounded-lg bg-background/85 px-3 py-1.5 text-sm backdrop-blur-md font-semibold border border-border/50 shadow-md">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="font-bold text-foreground">{hotel.rating.toFixed(1)}</span>
            <span className="text-muted-foreground text-xs">({hotel.reviews_count})</span>
          </div>
        </div>

        {/* Контент карточки */}
        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium mb-1">
              <MapPin className="w-4 h-4 shrink-0 text-primary" />
              <span>{hotel.city}{hotel.area ? `, ${hotel.area}` : ""}</span>
              <span className="mx-1">•</span>
              <span className="text-foreground font-semibold">{hotel.stars} ★</span>
            </div>
            <h3 className="text-xl font-bold text-foreground line-clamp-1 tracking-tight">
              {hotel.name}
            </h3>
          </div>

          {/* Теги отеля */}
          <div className="flex flex-wrap gap-2">
            {hotel.tags?.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs font-semibold py-1 px-3 bg-secondary/70 border-border text-foreground">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Рекомендованный номер */}
          {hotel.suitable_room && (
            <div className="rounded-xl border border-border/90 bg-background/60 p-3.5 text-sm space-y-1.5">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{hotel.suitable_room.name}</span>
              </div>
              {hotel.suitable_room.bed_setup && (
                <p className="text-muted-foreground text-xs font-medium pl-6">
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
      <div className="p-5 pt-3 border-t border-border mt-2 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground block">от</span>
          <div className="text-2xl font-black text-foreground">
            {formatPrice(hotel.min_price_per_night_rub)}
            <span className="text-sm font-normal text-muted-foreground"> / ночь</span>
          </div>
        </div>

        <Button
          onClick={() => onBook?.(hotel)}
          className="h-11 px-6 text-base font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all"
        >
          Забронировать
        </Button>
      </div>
    </Card>
  );
}
