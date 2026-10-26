"use client";

import { CheckCircle2, Clock, ExternalLink, MapPin, Navigation, Plane, Star, Train } from "lucide-react";
import React, { useState } from "react";

import { getOstrovokBookingUrl, Hotel, HotelScoreBadge } from "@/entities/hotel";
import { formatPrice } from "@/shared/lib";
import { Badge, Button } from "@/shared/ui";

interface ClassicSerpHotelCardProps {
  hotel: Hotel;
  isHighlighted?: boolean;
  onSelect: (hotel: Hotel) => void;
}

export function ClassicSerpHotelCard({
  hotel,
  isHighlighted = false,
  onSelect,
}: ClassicSerpHotelCardProps) {
  const fallbackCategory = ["mountains", "sea", "center", "nature"].includes(hotel.area_type)
    ? hotel.area_type
    : "center";
  const fallbackIndex = ((hotel.id.charCodeAt(0) || 1) % 5) + 1;
  const fallbackUrl = `/hotels/${fallbackCategory}/${fallbackIndex}.jpg`;

  const [imgSrc, setImgSrc] = useState<string>(hotel.image_urls?.[0] || fallbackUrl);

  const ostrovokUrl = getOstrovokBookingUrl(hotel.name, hotel.city);

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-300 md:flex-row ${
        isHighlighted
          ? "border-primary shadow-2xl ring-2 ring-primary/40"
          : "border-border hover:border-primary/50 hover:shadow-xl"
      }`}
    >
      {/* Левая колонка: Фотография */}
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-muted md:h-auto md:w-64">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={hotel.name}
          onError={() => {
            if (imgSrc !== fallbackUrl) setImgSrc(fallbackUrl);
          }}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute left-3 top-3 z-10">
          <HotelScoreBadge
            scorePct={hotel.match_score_pct}
            criteriaBreakdown={hotel.criteria_breakdown}
          />
        </div>
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-lg border border-border/50 bg-background/85 px-2.5 py-1 text-xs font-bold shadow-md backdrop-blur-md">
          <Star className="h-3.5 w-3.5 fill-rating text-rating" />
          <span className="text-foreground">{hotel.rating.toFixed(1)}</span>
          <span className="text-muted-foreground">({hotel.reviews_count})</span>
        </div>
      </div>

      {/* Центральная колонка: Информация об отеле */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div className="space-y-2.5">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>
                {hotel.city}
                {hotel.area ? `, ${hotel.area}` : ""}
              </span>
              <span>•</span>
              <span className="font-bold text-foreground">{hotel.stars} ★</span>
            </div>
            <h3
              onClick={() => onSelect(hotel)}
              className="line-clamp-1 cursor-pointer text-lg font-black tracking-tight text-foreground transition-colors hover:text-primary"
            >
              {hotel.name}
            </h3>
          </div>

          {/* Теги */}
          <div className="flex flex-wrap gap-1.5">
            {hotel.tags?.slice(0, 3).map((tag, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="border-border bg-secondary/50 px-2.5 py-0.5 text-xs text-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>

          {/* Логистика заезда, выезда и вокзал */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 rounded-md border border-border/60 bg-secondary/30 px-2 py-0.5 font-medium">
              <Clock className="h-3 w-3 text-primary" />
              Заезд с {hotel.checkin_from || "14:00"} • Выезд до {hotel.checkout_until || "12:00"}
            </span>
            {hotel.has_24h_front_desk && (
              <span className="rounded-md border border-border/60 bg-secondary/30 px-2 py-0.5 font-medium text-primary">
                Стойка 24/7
              </span>
            )}
            {hotel.nearest_hub && (
              <span className="flex items-center gap-1 rounded-md border border-border/60 bg-secondary/30 px-2 py-0.5 font-medium">
                <Navigation className="h-3 w-3 text-primary" />
                {hotel.nearest_hub.name.replace("Международный аэропорт ", "Аэропорт ").replace("-Пассажирский", "")}: {hotel.nearest_hub.distance_km} км
              </span>
            )}
          </div>

          {/* Рекомендованный номер */}
          {hotel.suitable_room && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{hotel.suitable_room.name}</span>
            </div>
          )}
        </div>

        {/* Билет включен */}
        {hotel.receipt?.train_ticket_rub || hotel.receipt?.transport_type === "train" ? (
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Train className="h-3.5 w-3.5 text-primary" />
            <span>Ж/Д билет включен в расчет под ключ</span>
          </div>
        ) : hotel.receipt?.flight_ticket_rub ? (
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Plane className="h-3.5 w-3.5 text-primary" />
            <span>Перелет включен в расчет под ключ</span>
          </div>
        ) : null}
      </div>

      {/* Правая колонка: Цены и кнопки действий */}
      <div className="flex w-full flex-col justify-between border-t border-border bg-card/60 p-5 md:w-56 md:border-l md:border-t-0">
        <div className="text-right md:text-right">
          <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            от
          </span>
          <div className="text-2xl font-black text-foreground">
            {formatPrice(hotel.min_price_per_night_rub)}
            <span className="text-xs font-normal text-muted-foreground"> / ночь</span>
          </div>
          {hotel.receipt?.total_with_transport_rub ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Всего:{" "}
              <span className="font-bold text-foreground">
                {formatPrice(hotel.receipt.total_with_transport_rub)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelect(hotel)}
            className="w-full rounded-xl text-xs font-semibold"
          >
            Подробнее
          </Button>

          <a
            href={ostrovokUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>На Островок</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
