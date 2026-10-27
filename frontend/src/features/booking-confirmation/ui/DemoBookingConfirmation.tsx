"use client";

import {
  BadgeCheck,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Users,
  Wallet,
} from "lucide-react";
import React, { useMemo, useState } from "react";

import { getOstrovokBookingUrl, type Hotel } from "@/entities/hotel";
import { formatPrice } from "@/shared/lib";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui";

import { buildBookingDetailsText } from "../lib/bookingDetailsText";
import { getDemoBookingDates } from "../lib/demoBookingDates";
import { generateDemoOrderNumber } from "../lib/demoOrderNumber";

interface DemoBookingConfirmationProps {
  hotel: Hotel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Количество гостей из текущей сессии поиска. */
  guests?: number;
}

/**
 * Экран подтверждения демо-бронирования (Issue #47, S15 / F25).
 * Честная финальная точка сценария: детерминированный номер заказа,
 * состав поездки и явный переход на реальный чекаут Ostrovok.ru.
 * Никаких фиктивных форм оплаты — только объяснение и deep-link.
 */
export function DemoBookingConfirmation({
  hotel,
  open,
  onOpenChange,
  guests = 2,
}: DemoBookingConfirmationProps) {
  const [isCopied, setIsCopied] = useState(false);

  const orderNumber = useMemo(() => generateDemoOrderNumber(hotel.id), [hotel.id]);
  const nights = hotel.receipt?.nights ?? 2;
  const dates = useMemo(() => getDemoBookingDates(nights), [nights]);
  const totalRub =
    hotel.receipt?.total_with_transport_rub ?? hotel.receipt?.total_rub ?? nights * hotel.min_price_per_night_rub;
  const roomName = hotel.suitable_room?.name || "Стандартный номер";
  const checkoutUrl = hotel.checkout_url || getOstrovokBookingUrl(hotel);

  const detailsText = useMemo(
    () =>
      buildBookingDetailsText({
        orderNumber,
        hotelName: hotel.name,
        city: hotel.city,
        roomName,
        checkinLabel: dates.checkinLabel,
        checkoutLabel: dates.checkoutLabel,
        guests,
        totalLabel: formatPrice(totalRub),
        checkoutUrl,
      }),
    [orderNumber, hotel.name, hotel.city, roomName, dates, guests, totalRub, checkoutUrl]
  );

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(detailsText);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен в окружении — молча сохраняем UI-состояние.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" data-testid="demo-booking-confirmation">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
            <BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Демо-бронь подтверждена
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Номер демо-заказа
          </span>
          <span className="font-mono text-base font-bold text-primary">{orderNumber}</span>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-background/60 p-4 text-sm">
          <div className="font-bold text-foreground">{hotel.name}</div>
          <div className="text-muted-foreground">
            {hotel.city}
            {hotel.area ? `, ${hotel.area}` : ""} • {hotel.stars} ★
          </div>
          <div className="border-t border-border/70 pt-2 text-muted-foreground">
            Номер: <span className="font-semibold text-foreground">{roomName}</span>
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Заезд {dates.checkinLabel}, заселение с 14:00
              <br />
              Выезд {dates.checkoutLabel}, до 12:00
            </span>
          </div>
          {hotel.receipt?.transfer_note && (
            <div className="text-muted-foreground">Трансфер: {hotel.receipt.transfer_note}</div>
          )}
          <div className="flex items-center justify-between border-t border-border/70 pt-2">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              {guests} гостя
            </span>
            <span className="flex items-center gap-2 font-bold text-foreground">
              <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
              {formatPrice(totalRub)}
              <span className="rounded-full border border-warning/40 bg-warning-bg px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                демо
              </span>
            </span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <p className="text-sm leading-relaxed text-foreground">
            Это учебная демо-бронь для хакатона: деньги не списываются. Но если отель вам
            действительно понравился — мы уже собрали ваши даты и гостей в готовый чекаут.
          </p>
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
          >
            Перейти на реальный чекаут Ostrovok.ru
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <Button
          variant="outline"
          onClick={handleCopy}
          className="h-10 w-full rounded-xl border-border bg-card text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-primary/10"
        >
          {isCopied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-primary" aria-hidden="true" />
              Скопировано
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Скопировать детали брони
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
