import { AlertCircle, CheckCircle2, Clock, ExternalLink, MapPin, Navigation, Plane, Star, Train } from "lucide-react";
import React from "react";

import { formatPrice } from "@/shared/lib";
import { Badge, Button, Card } from "@/shared/ui";

import { getOstrovokBookingUrl } from "../lib/hotelBookingUrl";
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

          {/* Логистика: время заезда, выезда и ближайший узел */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 rounded-md border border-border/70 bg-secondary/40 px-2 py-0.5 font-medium">
              <Clock className="h-3 w-3 text-primary" />
              Заезд с {hotel.checkin_from || "14:00"} • Выезд до {hotel.checkout_until || "12:00"}
            </span>
            {hotel.has_24h_front_desk && (
              <span className="rounded-md border border-border/70 bg-secondary/40 px-2 py-0.5 font-medium text-primary">
                Стойка 24/7
              </span>
            )}
            {hotel.nearest_hub && (
              <span className="flex items-center gap-1 rounded-md border border-border/70 bg-secondary/40 px-2 py-0.5 font-medium">
                <Navigation className="h-3 w-3 text-primary" />
                {hotel.nearest_hub.name.replace("Международный аэропорт ", "Аэропорт ").replace("-Пассажирская", "").replace("-Пассажирский", "")}: {hotel.nearest_hub.distance_km} км
              </span>
            )}
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

          {/* Включенный билет на транспорт */}
          {hotel.receipt?.train_ticket_rub || hotel.receipt?.transport_type === "train" ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <Train className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="font-semibold text-foreground">
                  {hotel.receipt.tickets_count && hotel.receipt.tickets_count > 1
                    ? `Ж/Д билеты (${hotel.receipt.tickets_count} чел.): ${formatPrice(hotel.receipt.train_ticket_rub || hotel.receipt.transport_ticket_rub || 0)}`
                    : `Ж/Д билет: ${formatPrice(hotel.receipt.train_ticket_rub || hotel.receipt.transport_ticket_rub || 0)}`}
                </span>
              </div>
              <span className="font-medium text-primary">Включен в чек</span>
            </div>
          ) : hotel.receipt?.flight_ticket_rub ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <Plane className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="font-semibold text-foreground">
                  {hotel.receipt.tickets_count && hotel.receipt.tickets_count > 1
                    ? `Авиабилеты (${hotel.receipt.tickets_count} чел.): ${formatPrice(hotel.receipt.flight_ticket_rub)}`
                    : `Билет на рейс: ${formatPrice(hotel.receipt.flight_ticket_rub)}`}
                </span>
              </div>
              <span className="font-medium text-primary">Включен в чек</span>
            </div>
          ) : null}

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
          {hotel.receipt?.total_with_transport_rub ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Вся поездка под ключ:{" "}
              <span className="font-bold text-foreground">
                {formatPrice(hotel.receipt.total_with_transport_rub)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {onSelect && (
            <Button
              variant="outline"
              onClick={() => onSelect(hotel)}
              className="h-11 rounded-xl border-border bg-card/60 px-3.5 text-sm font-semibold hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              Подробнее
            </Button>
          )}
          <a
            href={getOstrovokBookingUrl(hotel)}
            target="_blank"
            rel="noopener noreferrer"
            title="Забронировать на Ostrovok.ru"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground"
          >
            <span>Островок</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </Card>
  );
}
