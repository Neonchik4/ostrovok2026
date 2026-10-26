"use client";

import { Check, ExternalLink, Utensils } from "lucide-react";
import React from "react";

import { getOstrovokBookingUrl, Hotel } from "@/entities/hotel";
import { formatPrice } from "@/shared/lib";
import { Badge } from "@/shared/ui";

interface HotelRoomsGridProps {
  hotel: Hotel;
}

interface RoomTariff {
  id: string;
  name: string;
  description: string;
  capacity: string;
  hasBreakfast: boolean;
  freeCancellation: boolean;
  pricePerNight: number;
}

export function HotelRoomsGrid({ hotel }: HotelRoomsGridProps) {
  const basePrice = hotel.min_price_per_night_rub || 8000;
  const hotelHasBreakfastTag = (hotel.tags || []).some(
    (t) => t.toLowerCase().includes("завтрак") || t.toLowerCase().includes("питание")
  );

  const tariffs: RoomTariff[] = [
    {
      id: "std",
      name: "Стандартный двухместный номер",
      description: "Уютный номер с одной двуспальной кроватью или двумя раздельными, собственная ванная комната, Wi-Fi и кондиционер.",
      capacity: "2 гостя",
      hasBreakfast: hotelHasBreakfastTag,
      freeCancellation: true,
      pricePerNight: basePrice,
    },
    {
      id: "dlx",
      name: "Номер Делюкс с улучшенным видом",
      description: "Просторный номер увеличенной площади с панорамными окнами, рабочей зоной, халатами и набором для чая.",
      capacity: "2–3 гостя",
      hasBreakfast: true,
      freeCancellation: true,
      pricePerNight: Math.round(basePrice * 1.25),
    },
    {
      id: "ste",
      name: "Представительский Люкс",
      description: "Двухкомнатный номер с гостиной зоной, премиальной косметикой, доступом в спа-комплекс и персональным сервисом.",
      capacity: "2–4 гостя",
      hasBreakfast: true,
      freeCancellation: true,
      pricePerNight: Math.round(basePrice * 1.6),
    },
  ];

  const bookingUrl = getOstrovokBookingUrl(hotel);

  return (
    <section aria-label="Сетка тарифов и номеров" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black tracking-tight text-foreground md:text-lg">
          Доступные номера и тарифы
        </h3>
        <span className="text-xs text-muted-foreground">Гарантия лучшей цены Островка</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tariffs.map((tariff) => (
          <div
            key={tariff.id}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card/80 p-4 transition-all hover:border-primary/40 hover:shadow-lg"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold leading-snug text-foreground">
                  {tariff.name}
                </h4>
                <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                  {tariff.capacity}
                </Badge>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {tariff.description}
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {tariff.hasBreakfast ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <Utensils className="h-3 w-3" />
                    Завтрак включен
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                    Без питания
                  </span>
                )}
                {tariff.freeCancellation && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                    Бесплатная отмена
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  за 1 ночь
                </span>
                <span className="text-base font-black text-foreground">
                  {formatPrice(tariff.pricePerNight)}
                </span>
              </div>

              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow transition-transform hover:scale-105 active:scale-95"
              >
                <span>Выбрать</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
