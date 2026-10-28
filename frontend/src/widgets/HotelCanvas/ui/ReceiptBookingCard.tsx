"use client";

import { CalendarCheck } from "lucide-react";
import React, { useState } from "react";

import { Hotel, HotelReceiptPreview } from "@/entities/hotel";
import { DemoBookingConfirmation } from "@/features/booking-confirmation";
import { ShareTripButton, toCompactHotelSnapshot } from "@/features/share-trip";
import { Button, Card } from "@/shared/ui";

interface ReceiptBookingCardProps {
  hotel: Hotel;
}

/**
 * Карточка прозрачного чека с кнопкой оформления демо-брони (Issue #47)
 * и кнопкой шаринга поездки (Issue #36).
 */
export function ReceiptBookingCard({ hotel }: ReceiptBookingCardProps) {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  return (
    <Card className="rounded-2xl border-border bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Прозрачный чек
        </span>
        <ShareTripButton
          state={{
            city: hotel.city,
            selected_hotel_id: hotel.id,
            nights: hotel.receipt?.nights,
            guests: hotel.receipt?.tickets_count,
            stars: hotel.stars,
            max_price_per_night_rub: hotel.min_price_per_night_rub,
            user_message: `Отель «${hotel.name}» в ${hotel.city}`,
            assistant_message: `Вот готовая поездка с прозрачным чеком в отель «${hotel.name}» (${hotel.city}). Все условия и стоимость проживания зафиксированы.`,
            hotels: [toCompactHotelSnapshot(hotel)],
          }}
          label="Поделиться"
          size="sm"
        />
      </div>
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
        guests={hotel.receipt?.tickets_count}
      />
    </Card>
  );
}
