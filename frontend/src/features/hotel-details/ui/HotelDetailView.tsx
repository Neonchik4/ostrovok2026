"use client";

import {
  AlertCircle,
  ArrowLeft,
  Clock,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { getOstrovokBookingUrl, Hotel, HotelScoreBadge } from "@/entities/hotel";
import { TransportSummaryData } from "@/shared/api";
import { formatPrice } from "@/shared/lib";
import { Button } from "@/shared/ui";

import { HotelAspectsSummary } from "./HotelAspectsSummary";
import { HotelReviewsList } from "./HotelReviewsList";
import { HotelRoomsGrid } from "./HotelRoomsGrid";
import { HotelTravelTimeline } from "./HotelTravelTimeline";

interface HotelDetailViewProps {
  hotel: Hotel;
  transport?: TransportSummaryData | null;
  onBack: () => void;
}

export function HotelDetailView({ hotel, transport, onBack }: HotelDetailViewProps) {
  const [detailedHotel, setDetailedHotel] = useState<Hotel>(hotel);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setDetailedHotel(hotel);
    setActiveImageIdx(0);

    let isSubscribed = true;
    setIsLoading(true);
    fetch(`/api/hotels/${hotel.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isSubscribed && data) {
          const fetchedReviews = data.reviews || data.top_reviews || [];
          setDetailedHotel((prev) => ({
            ...prev,
            ...data,
            reviews: fetchedReviews.length > 0 ? fetchedReviews : prev.reviews,
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isSubscribed) setIsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [hotel]);

  const images = detailedHotel.image_urls?.length
    ? detailedHotel.image_urls
    : ["/hotels/center/1.jpg"];
  const currentImg = images[activeImageIdx] || images[0];
  const bookingUrl = getOstrovokBookingUrl(detailedHotel);

  return (
    <article
      data-testid="hotel-detail-view"
      className="mx-auto flex w-full max-w-5xl flex-col space-y-6 pb-12 animate-fade-in"
    >
      {/* Навигационная панель назад */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="group flex items-center gap-2 rounded-xl border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>Назад к вариантам</span>
        </Button>

        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-md transition-all hover:scale-105 active:scale-95"
        >
          <span>Забронировать на Ostrovok.ru</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Заголовок отеля, локация и звездность */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>
              {detailedHotel.city}
              {detailedHotel.area ? `, ${detailedHotel.area}` : ""}
            </span>
            <span className="mx-1">•</span>
            <span className="font-bold text-foreground">{detailedHotel.stars} ★</span>
          </div>
          <HotelScoreBadge
            scorePct={detailedHotel.match_score_pct}
            criteriaBreakdown={detailedHotel.criteria_breakdown}
          />
        </div>

        {detailedHotel.compromise_note && (
          <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-bg/40 p-3 text-xs font-semibold text-warning">
            <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
            <span>Компромисс: {detailedHotel.compromise_note}</span>
          </div>
        )}

        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          {detailedHotel.name}
        </h1>

        {detailedHotel.address && (
          <p className="text-xs text-muted-foreground sm:text-sm">{detailedHotel.address}</p>
        )}
      </header>

      {/* Галерея фотографий */}
      <section aria-label="Галерея фотографий" className="space-y-3">
        <div className="relative h-72 w-full overflow-hidden rounded-3xl border border-border bg-muted shadow-lg md:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImg}
            alt={detailedHotel.name}
            className="h-full w-full object-cover transition-transform duration-300"
          />
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-border/50 bg-background/85 px-3.5 py-2 text-sm font-bold shadow-md backdrop-blur-md">
            <Star className="h-4 w-4 fill-rating text-rating" />
            <span className="text-foreground">{detailedHotel.rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">
              ({detailedHotel.reviews_count} проверенных отзывов)
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
      </section>

      {/* Сетка тарифов и номеров */}
      <HotelRoomsGrid hotel={detailedHotel} />

      {/* Блок логистики: график поездки и правила заселения */}
      <section aria-label="Логистика и время заезда" className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-base font-black tracking-tight text-foreground md:text-lg">
            Логистика и заселение
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3.5">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Заезд и выезд</div>
              <div className="text-sm font-bold text-foreground">Заезд с 14:00 • Выезд до 12:00</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3.5">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Стойка регистрации</div>
              <div className="text-sm font-bold text-foreground">Круглосуточная стойка 24/7</div>
            </div>
          </div>
        </div>
        <HotelTravelTimeline hotel={detailedHotel} transport={transport} />
      </section>

      {/* Описание отеля */}
      {detailedHotel.description && (
        <section aria-label="Об отеле" className="space-y-2">
          <h3 className="text-base font-black tracking-tight text-foreground md:text-lg">Об отеле</h3>
          <div className="rounded-2xl border border-border bg-card/60 p-4 text-sm leading-relaxed text-muted-foreground">
            {detailedHotel.description}
          </div>
        </section>
      )}

      {/* Анализ аспектов и реальные отзывы гостей */}
      <HotelAspectsSummary summary={detailedHotel.reviews_summary} />
      <HotelReviewsList
        reviews={detailedHotel.reviews || detailedHotel.top_reviews}
        isLoading={isLoading && !detailedHotel.reviews?.length && !detailedHotel.top_reviews?.length}
      />

      {/* Фиксированная нижняя панель бронирования */}
      <footer className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-card/95 p-4 px-6 shadow-2xl backdrop-blur-md">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Лучшая цена за ночь
          </span>
          <div className="text-2xl font-black text-foreground">
            {formatPrice(detailedHotel.min_price_per_night_rub)}
            <span className="text-xs font-normal text-muted-foreground"> / ночь</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-11 rounded-xl px-5 text-xs font-semibold"
          >
            Назад к списку
          </Button>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Забронировать на Ostrovok.ru</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </footer>
    </article>
  );
}
