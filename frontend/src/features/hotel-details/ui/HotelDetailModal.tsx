"use client";

import React, { useEffect, useState } from "react";
import { Hotel, HotelScoreBadge } from "@/entities/hotel";
import { formatPrice } from "@/shared/lib";
import { Button, Card, Badge } from "@/shared/ui";
import { HotelAspectsSummary } from "./HotelAspectsSummary";
import { HotelReviewsList } from "./HotelReviewsList";
import {
  X,
  Star,
  MapPin,
  CheckCircle2,
  Sparkles,
  Wifi,
  Coffee,
  Waves,
  Dog,
  Loader2,
} from "lucide-react";

interface HotelDetailModalProps {
  hotel: Hotel | null;
  onClose: () => void;
}

export function HotelDetailModal({ hotel, onClose }: HotelDetailModalProps) {
  const [detailedHotel, setDetailedHotel] = useState<Hotel | null>(hotel);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hotel) {
      setDetailedHotel(null);
      return;
    }

    setDetailedHotel(hotel);
    setActiveImageIdx(0);

    // Подгружаем полные данные с отзывами из API
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
            ...(prev || hotel),
            ...data,
          }));
        }
      })
      .catch(() => {
        // Fallback: используем уже переданный отель
      })
      .finally(() => {
        if (isSubscribed) setIsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [hotel]);

  if (!hotel || !detailedHotel) return null;

  const currentHotel = detailedHotel;
  const images =
    currentHotel.image_urls && currentHotel.image_urls.length > 0
      ? currentHotel.image_urls
      : [`/hotels/center/1.jpg`];

  const currentImg = images[activeImageIdx] || images[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hotel-modal-title"
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <Card className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden border-border bg-card shadow-2xl">
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 z-10 rounded-full border border-border/60 bg-background/80 p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Скроллируемая область контента */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Заголовок */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>
                  {currentHotel.city}
                  {currentHotel.area ? `, ${currentHotel.area}` : ""}
                </span>
                <span className="mx-1">•</span>
                <span className="font-semibold text-foreground">{currentHotel.stars} ★</span>
              </div>
              <HotelScoreBadge scorePct={currentHotel.match_score_pct} />
            </div>

            <h2 id="hotel-modal-title" className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
              {currentHotel.name}
            </h2>

            {currentHotel.address && (
              <p className="mt-1 text-xs text-muted-foreground">{currentHotel.address}</p>
            )}
          </div>

          {/* Галерея фотографий */}
          <div className="space-y-2">
            <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-border bg-muted md:h-80">
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

            {/* Миниатюры */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.slice(0, 6).map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border transition-all ${
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

          {/* Описание отеля */}
          {currentHotel.description && (
            <div className="rounded-xl border border-border bg-background/50 p-4 text-xs leading-relaxed text-muted-foreground">
              {currentHotel.description}
            </div>
          )}

          {/* Анализ отзывов AI агентом: плюсы, минусы, типы гостей */}
          <HotelAspectsSummary summary={currentHotel.reviews_summary} />

          {/* Список реальных отзывов */}
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

        {/* Футер с ценой и действием */}
        <div className="flex items-center justify-between border-t border-border bg-card/90 p-5 px-6">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              от
            </span>
            <div className="text-2xl font-black text-foreground">
              {formatPrice(currentHotel.min_price_per_night_rub)}
              <span className="text-sm font-normal text-muted-foreground"> / ночь</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-xl px-5 text-sm font-semibold"
            >
              Закрыть
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
