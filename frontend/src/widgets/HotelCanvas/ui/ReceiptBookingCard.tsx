"use client";

import { CalendarCheck } from "lucide-react";
import React, { useState } from "react";

import { Hotel, HotelReceiptPreview } from "@/entities/hotel";
import { DemoBookingConfirmation } from "@/features/booking-confirmation";
import { Button, Card } from "@/shared/ui";

interface ReceiptBookingCardProps {
  hotel: Hotel;
}

/**
 * Карточка прозрачного чека с кнопкой оформления демо-брони (Issue #47).
 * Клик по кнопке бронирования в квитанции открывает экран подтверждения
 * демо-заказа с переходом на реальный чекаут Ostrovok.ru.
 */
export function ReceiptBookingCard({ hotel }: ReceiptBookingCardProps) {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  return (
    <Card className="rounded-2xl border-border bg-card p-5">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Прозрачный чек
      </span>
      <HotelReceiptPreview receipt={hotel.receipt} />
      <Button
        variant="outline"
        onClick={() => setIsConfirmationOpen(true)}
        data-testid="demo-booking-trigger"
        className="mt-3 h-10 w-full rounded-xl border-primary/40 bg-primary/10 text-xs font-bold text-primary transition-all hover:bg-primary/20 hover:text-primary"
      >
        <CalendarCheck className="mr-2 h-4 w-4" aria-hidden="true" />
        Оформить демо-бронь по этому чеку
      </Button>
      <DemoBookingConfirmation
        hotel={hotel}
        open={isConfirmationOpen}
        onOpenChange={setIsConfirmationOpen}
      />
    </Card>
  );
}
