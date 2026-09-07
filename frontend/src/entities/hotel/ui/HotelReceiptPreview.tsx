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
    <div className="mt-3 rounded-lg border border-border bg-background/50 p-3 text-xs space-y-1.5">
      <div className="flex items-center justify-between font-medium text-foreground">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
          Детализация стоимости ({receipt.nights} {receipt.nights === 1 ? "ночь" : "ночи"}):
        </span>
        <span className="text-primary font-semibold text-sm">
          {formatPrice(receipt.total_rub)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-1 text-muted-foreground pt-1 border-t border-border">
        <span>Проживание:</span>
        <span className="text-right text-foreground">{formatPrice(receipt.base_accommodation_cost_rub)}</span>

        {receipt.pet_deposit_rub > 0 && (
          <>
            <span>Сбор за питомца:</span>
            <span className="text-right text-foreground">{formatPrice(receipt.pet_deposit_rub)}</span>
          </>
        )}

        <span>Курортный сбор:</span>
        <span className="text-right text-foreground">{formatPrice(receipt.resort_tax_rub)}</span>
      </div>

      <div className="pt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>{receipt.cancellation_deadline || "Бесплатная отмена"}</span>
      </div>
    </div>
  );
}
