"use client";

import { Building2, Car, CheckCircle2, Clock, Luggage, MapPin, Plane, Train } from "lucide-react";
import React from "react";

import { Hotel } from "@/entities/hotel";
import { TransportSummaryData } from "@/shared/api";
import { formatPrice } from "@/shared/lib";

interface HotelTravelTimelineProps {
  hotel: Hotel;
  transport?: TransportSummaryData | null;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return "14:15";
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export function HotelTravelTimeline({ hotel, transport }: HotelTravelTimelineProps) {
  const isTrain = transport?.preferred_mode === "train" || hotel.receipt?.transport_type === "train";

  const originCity = transport?.origin_city || "Анапа";
  const destCity = transport?.destination_city || hotel.city;

  const depTime = isTrain
    ? transport?.recommended_train?.departure_at?.slice(11, 16) || "14:40"
    : transport?.recommended_flight?.departure_at?.slice(11, 16) || "09:30";

  const arrTime = isTrain
    ? transport?.recommended_train?.arrival_at?.slice(11, 16) || "08:15"
    : transport?.arrival_time || "13:45";

  const transportTitle = isTrain
    ? transport?.recommended_train?.train_number || "011Э «Анапа — Москва»"
    : transport?.recommended_flight?.airline || "S7 Airlines";

  const ticketPrice = isTrain
    ? hotel.receipt?.train_ticket_rub || transport?.recommended_train?.price_from_rub || 3600
    : hotel.receipt?.flight_ticket_rub || transport?.recommended_flight?.price_rub || 5200;

  const targetStation = hotel.nearest_station;
  const targetAirport = hotel.nearest_airport || (hotel.nearest_hub?.hub_type === "airport" ? hotel.nearest_hub : undefined);

  const hubName = isTrain
    ? targetStation?.name || "Казанский вокзал"
    : targetAirport?.name || "Аэропорт Внуково";

  const transferMin = isTrain
    ? targetStation?.travel_time_min || targetStation?.taxi_time_min || 15
    : targetAirport?.taxi_time_min || 45;

  const transferDist = isTrain
    ? targetStation?.distance_km || 6.8
    : targetAirport?.distance_km || 25;

  const transferCost = hotel.receipt?.transfer_cost_rub || (isTrain ? 650 : 1050);

  const hotelArrivalTime = addMinutesToTime(arrTime, transferMin);
  const checkinTime = hotel.checkin_from || "14:00";
  const checkoutTime = hotel.checkout_until || "12:00";

  const isEarlyArrival = isTrain || arrTime < "13:00";

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          {isTrain ? (
            <Train className="h-4 w-4 text-primary" />
          ) : (
            <Plane className="h-4 w-4 text-primary" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Поминутный график поездки: {originCity} → {destCity}
          </span>
        </div>
        <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
          {isTrain ? "Ж/Д маршрут" : "Авиаперелет"}
        </span>
      </div>

      <div className="relative space-y-4 pl-6 before:absolute before:bottom-3 before:left-2.5 before:top-3 before:w-0.5 before:bg-border">
        {/* Шаг 1: Выезд */}
        <div className="relative">
          <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-primary/50 bg-background text-primary">
            {isTrain ? <Train className="h-3 w-3" /> : <Plane className="h-3 w-3" />}
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-foreground">{depTime}</span>
              <span className="text-xs font-semibold text-foreground">Отправление из {originCity}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {transportTitle} • {hotel.receipt?.tickets_count && hotel.receipt.tickets_count > 1 ? `Билеты (${hotel.receipt.tickets_count} чел.)` : "Билет"} {formatPrice(ticketPrice)} включен в общий чек
            </p>
          </div>
        </div>

        {/* Шаг 2: Прибытие на транспортный узел */}
        <div className="relative">
          <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-foreground">{arrTime}</span>
              <span className="text-xs font-semibold text-foreground">Прибытие в {destCity}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {hubName}
            </p>
          </div>
        </div>

        {/* Шаг 3: Трансфер до отеля */}
        <div className="relative">
          <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
            <Car className="h-3 w-3 text-primary" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-foreground">~{hotelArrivalTime}</span>
              <span className="text-xs font-semibold text-foreground">Прибытие в отель</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Дорога на такси: ~{transferDist} км, ~{transferMin} мин (~{formatPrice(transferCost)})
            </p>
          </div>
        </div>

        {/* Шаг 4: Заселение и камера хранения */}
        <div className="relative">
          <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
            <Building2 className="h-3 w-3" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-foreground">с {checkinTime}</span>
              <span className="text-xs font-semibold text-foreground">Заселение (Check-in)</span>
            </div>
            {isEarlyArrival ? (
              <div className="mt-1 flex items-start gap-1.5 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground">
                <Luggage className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                <span>
                  При утреннем прибытии к ~{hotelArrivalTime} вещи можно бесплатно оставить в камере хранения отеля до готовности номера.
                </span>
              </div>
            ) : (
              <div className="mt-1 flex items-start gap-1.5 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                <span>
                  Идеальная состыковка: заселение в номер сразу по прибытии в отель без ожидания.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Шаг 5: Выезд из отеля и камера хранения */}
        <div className="relative">
          <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
            <Clock className="h-3 w-3 text-primary" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-foreground">до {checkoutTime}</span>
              <span className="text-xs font-semibold text-foreground">Выезд из отеля (Check-out)</span>
            </div>
            <div className="mt-1 flex items-start gap-1.5 rounded-lg border border-border/80 bg-background/60 p-2 text-xs text-muted-foreground">
              <Luggage className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
              <span>
                Расчетный час до {checkoutTime}. При позднем рейсе или поезде багаж можно бесплатно оставить в камере хранения отеля. Обратный трансфер до {hubName}: ~{transferMin} мин.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
