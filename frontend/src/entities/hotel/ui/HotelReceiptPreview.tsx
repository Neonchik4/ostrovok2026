import React from "react";
import { formatPrice } from "@/shared/lib";
import { ShieldCheck, Info } from "lucide-react";

interface ReceiptProps {
  receipt?: {
    nights: number;
    price_per_night_rub: number;
    base_accommodation_cost_rub: number;
    pet_deposit_rub: number;
    resort_tax_rub: number;
    total_rub: number;
    is_free_cancellation: boolean;
    cancellation_deadline?: string;
  };
}

export function HotelReceiptPreview({ receipt }: ReceiptProps) {
  if (!receipt) return null;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-background/70 p-4 text-sm backdrop-blur-sm">
      <div className="flex items-center justify-between font-semibold text-foreground">
        <span className="flex items-center gap-1.5 text-sm">
          <Info className="h-4 w-4 text-primary" />
          Детализация стоимости ({receipt.nights} {receipt.nights === 1 ? "ночь" : "ночи"}):
        </span>
        <span className="text-base font-bold text-primary">{formatPrice(receipt.total_rub)}</span>
      </div>

      <div className="grid grid-cols-2 gap-y-1.5 border-t border-border/80 pt-1.5 text-sm text-muted-foreground">
        <span>Проживание:</span>
        <span className="text-right font-medium text-foreground">
          {formatPrice(receipt.base_accommodation_cost_rub)}
        </span>

        {receipt.pet_deposit_rub > 0 && (
          <>
            <span>Сбор за питомца:</span>
            <span className="text-right font-medium text-foreground">
              {formatPrice(receipt.pet_deposit_rub)}
            </span>
          </>
        )}

        <span>Курортный сбор:</span>
        <span className="text-right font-medium text-foreground">
          {formatPrice(receipt.resort_tax_rub)}
        </span>
      </div>

      <div className="flex items-center gap-2 border-t border-border/50 pt-2 text-xs font-semibold text-emerald-400">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>{receipt.cancellation_deadline || "Бесплатная отмена"}</span>
      </div>
    </div>
  );
}
