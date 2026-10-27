"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Star,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { Hotel, HotelScoreBadge } from "@/entities/hotel";
import { HotelAspectsSummary, HotelReviewsList } from "@/features/hotel-details";
import { formatPrice } from "@/shared/lib";
import { Badge, Button, Card } from "@/shared/ui";

import { ReceiptBookingCard } from "./ReceiptBookingCard";

interface HotelCanvasDetailViewProps {
  hotel: Hotel;
  onBack: () => void;
}

export function HotelCanvasDetailView({ hotel, onBack }: HotelCanvasDetailViewProps) {
  const [detailedHotel, setDetailedHotel] = useState<Hotel>(hotel);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setDetailedHotel(hotel);
    setActiveImageIdx(0);

    let isSubscribed = true;
    setIsLoading(true);

    fetch(`/api/hotels/${hotel.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        if (isSubscribed && data) {
          setDetailedHotel((prev) => ({
            ...prev,
            ...data,
          }));
        }
      })
      .catch(() => {
        // Fallback: сохраняем базовые данные
      })
      .finally(() => {
        if (isSubscribed) setIsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [hotel]);

  const currentHotel = detailedHotel;
  const images =
    currentHotel.image_urls && currentHotel.image_urls.length > 0
      ? currentHotel.image_urls
      : [`/hotels/center/1.jpg`];
  const currentImg = images[activeImageIdx] || images[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in pb-12">
      {/* Верхняя панель навигации инлайн-просмотра */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="h-10 rounded-xl border-border bg-card/60 px-4 text-xs font-semibold hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к отелям
        </Button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              от
            </span>
            <span className="text-lg font-black text-foreground">
              {formatPrice(currentHotel.min_price_per_night_rub)}
              <span className="text-xs font-normal text-muted-foreground"> / ночь</span>
            </span>
          </div>

          {currentHotel.checkout_url && (
            <a
              href={currentHotel.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
            >
              Забронировать
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Заголовок отеля и бейджи */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>
              {currentHotel.city}
              {currentHotel.area ? `, ${currentHotel.area}` : ""}
            </span>
            <span className="mx-1">•</span>
            <span className="font-semibold text-foreground">{currentHotel.stars} ★</span>
          </div>

          <HotelScoreBadge
            scorePct={currentHotel.match_score_pct}
            criteriaBreakdown={currentHotel.criteria_breakdown}
          />
        </div>

        {currentHotel.compromise_note && (
          <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-bg/40 p-2.5 text-xs font-semibold text-warning">
            <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
            <span>Компромисс: {currentHotel.compromise_note}</span>
          </div>
        )}

        <h1 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
          {currentHotel.name}
        </h1>

        {currentHotel.address && (
          <p className="text-xs text-muted-foreground">{currentHotel.address}</p>
        )}
      </div>

      {/* Фотогалерея */}
      <div className="space-y-3">
        <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-border bg-muted md:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImg}
            alt={currentHotel.name}
            className="h-full w-full object-cover transition-transform duration-300"
          />
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/85 px-3 py-1.5 text-sm font-bold shadow-md backdrop-blur-md">
            <Star className="h-4 w-4 fill-rating text-rating" />
            <span className="text-foreground">{currentHotel.rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">
              ({currentHotel.reviews_count} отзывов)
            </span>
          </div>
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.slice(0, 8).map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIdx(idx)}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border transition-all ${
                  activeImageIdx === idx
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-border opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Теги */}
      {currentHotel.tags && currentHotel.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {currentHotel.tags.map((tag, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="border-border bg-card px-3 py-1 text-xs font-semibold text-foreground"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Рекомендованный номер и чек */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border-border bg-card p-5">
          <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Номерной фонд
          </span>
          {currentHotel.suitable_room ? (
            <div className="space-y-2 rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{currentHotel.suitable_room.name}</span>
              </div>
              {currentHotel.suitable_room.bed_setup && (
                <p className="text-xs text-muted-foreground">
                  {currentHotel.suitable_room.bed_setup}
                  {currentHotel.suitable_room.area_sqm
                    ? ` • ${currentHotel.suitable_room.area_sqm} м²`
                    : ""}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Стандартный номер с удобствами выбран для расчета стоимости.
            </p>
          )}

          {currentHotel.description && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground border-t border-border/60 pt-3">
              {currentHotel.description}
            </p>
          )}
        </Card>

        <ReceiptBookingCard hotel={currentHotel} />
      </div>

      {/* Аспектный анализ отзывов AI агентом */}
      <HotelAspectsSummary summary={currentHotel.reviews_summary} />

      {/* Список отзывов */}
      {currentHotel.reviews && currentHotel.reviews.length > 0 ? (
        <HotelReviewsList reviews={currentHotel.reviews} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          Загрузка проверенных отзывов...
        </div>
      ) : (
        <HotelReviewsList reviews={[]} />
      )}
    </div>
  );
}
