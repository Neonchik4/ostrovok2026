"use client";

import React, { useState } from "react";
import { Button, Card } from "@/shared/ui";
import { formatPrice } from "@/shared/lib";
import { Hotel } from "@/entities/hotel";
import { X, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

interface BookRoomModalProps {
  hotel: Hotel | null;
  onClose: () => void;
}

export function BookRoomModal({ hotel, onClose }: BookRoomModalProps) {
  const [isBooked, setIsBooked] = useState(false);

  if (!hotel) return null;

  const receipt = hotel.receipt;

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <Card className="relative w-full max-w-lg overflow-hidden border-border bg-card p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {isBooked ? (
          <div className="space-y-3 py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Бронирование подтверждено!</h3>
            <p className="text-sm text-muted-foreground">
              Номер в <span className="font-semibold text-foreground">{hotel.name}</span> успешно
              зарезервирован по специальной цене Островка.
            </p>
            <div className="pt-4">
              <Button onClick={onClose} className="w-full bg-primary text-primary-foreground">
                Отлично
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <Sparkles className="h-4 w-4" />
                <span>Гарантия лучшей цены Островок</span>
              </div>
              <h3 className="text-2xl font-black text-foreground">{hotel.name}</h3>
              <p className="text-sm font-medium text-muted-foreground">
                {hotel.city}, {hotel.address || hotel.area}
              </p>
            </div>

            {hotel.suitable_room && (
              <div className="space-y-1 rounded-xl border border-border bg-background/60 p-4 text-base">
                <div className="text-base font-bold text-foreground">
                  {hotel.suitable_room.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {hotel.suitable_room.bed_setup}
                  {hotel.suitable_room.area_sqm ? ` • ${hotel.suitable_room.area_sqm} м²` : ""}
                </div>
              </div>
            )}

            {receipt && (
              <div className="space-y-2.5 rounded-xl border border-border bg-background/80 p-4 text-sm">
                <div className="border-b border-border pb-2 text-sm font-semibold text-foreground">
                  Прозрачный расчет чека без скрытых комиссий:
                </div>
                <div className="space-y-1.5 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>
                      {receipt.nights} ночи × {formatPrice(receipt.price_per_night_rub)}:
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatPrice(receipt.base_accommodation_cost_rub)}
                    </span>
                  </div>
                  {receipt.pet_deposit_rub > 0 && (
                    <div className="flex justify-between">
                      <span>Сбор и залог за питомца:</span>
                      <span className="font-semibold text-foreground">
                        {formatPrice(receipt.pet_deposit_rub)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Курортный сбор:</span>
                    <span className="font-semibold text-foreground">
                      {formatPrice(receipt.resort_tax_rub)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2.5 text-base font-bold text-foreground">
                  <span>Итого к оплате:</span>
                  <span className="text-xl font-black text-primary">
                    {formatPrice(receipt.total_rub)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>{receipt?.cancellation_deadline || "Бесплатная отмена бронирования"}</span>
            </div>

            <div className="flex gap-3 pt-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="h-12 flex-1 rounded-xl text-base font-semibold"
              >
                Отмена
              </Button>
              <Button
                onClick={() => setIsBooked(true)}
                className="h-12 flex-1 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
              >
                Подтвердить
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
