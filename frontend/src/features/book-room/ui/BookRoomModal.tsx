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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-lg bg-card border-border shadow-2xl overflow-hidden p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <X className="h-5 w-5" />
        </button>

        {isBooked ? (
          <div className="text-center py-6 space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Бронирование подтверждено!</h3>
            <p className="text-sm text-muted-foreground">
              Номер в <span className="text-foreground font-semibold">{hotel.name}</span> успешно зарезервирован по специальной цене Островка.
            </p>
            <div className="pt-4">
              <Button onClick={onClose} className="w-full bg-primary text-primary-foreground">
                Отлично
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-primary font-medium mb-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Гарантия лучшей цены Островок</span>
              </div>
              <h3 className="text-lg font-bold text-foreground">{hotel.name}</h3>
              <p className="text-xs text-muted-foreground">{hotel.city}, {hotel.address || hotel.area}</p>
            </div>

            {hotel.suitable_room && (
              <div className="rounded-lg border border-border bg-background/50 p-3 text-sm space-y-1">
                <div className="font-semibold text-foreground">{hotel.suitable_room.name}</div>
                <div className="text-xs text-muted-foreground">
                  {hotel.suitable_room.bed_setup}
                  {hotel.suitable_room.area_sqm ? ` • ${hotel.suitable_room.area_sqm} м²` : ""}
                </div>
              </div>
            )}

            {receipt && (
              <div className="rounded-lg border border-border bg-background/70 p-3.5 text-xs space-y-2">
                <div className="font-medium text-foreground border-b border-border pb-1.5">
                  Прозрачный расчет чека без скрытых комиссий:
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{receipt.nights} ночи × {formatPrice(receipt.price_per_night_rub)}:</span>
                    <span className="text-foreground">{formatPrice(receipt.base_accommodation_cost_rub)}</span>
                  </div>
                  {receipt.pet_deposit_rub > 0 && (
                    <div className="flex justify-between">
                      <span>Сбор и залог за питомца:</span>
                      <span className="text-foreground">{formatPrice(receipt.pet_deposit_rub)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Курортный сбор:</span>
                    <span className="text-foreground">{formatPrice(receipt.resort_tax_rub)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border text-sm font-bold text-foreground">
                  <span>Итого к оплате:</span>
                  <span className="text-primary text-base">{formatPrice(receipt.total_rub)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{receipt?.cancellation_deadline || "Бесплатная отмена бронирования"}</span>
            </div>

            <div className="pt-2 flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Отмена
              </Button>
              <Button
                onClick={() => setIsBooked(true)}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
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
