import { AlertTriangle, Car, Info, Plane, ShieldCheck, Train } from "lucide-react";
import React from "react";

import { formatPrice } from "@/shared/lib";

interface ReceiptProps {
  receipt?: {
    nights: number;
    price_per_night_rub: number;
    base_accommodation_cost_rub: number;
    pet_deposit_rub: number;
    resort_tax_rub: number;
    transfer_cost_rub?: number;
    flight_ticket_rub?: number;
    train_ticket_rub?: number;
    transport_ticket_rub?: number;
    ticket_price_per_person_rub?: number;
    tickets_count?: number;
    transport_type?: "flight" | "train";
    transport_name?: string;
    total_rub: number;
    total_with_transport_rub?: number;
    is_free_cancellation: boolean;
    cancellation_deadline?: string;
    transfer_note?: string;
    arrival_warning?: string;
  };
}

export function HotelReceiptPreview({ receipt }: ReceiptProps) {
  if (!receipt) return null;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-background/70 p-4 text-sm backdrop-blur-sm">
      {receipt.arrival_warning && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-bg/30 p-2 text-xs font-semibold text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span>{receipt.arrival_warning}</span>
        </div>
      )}

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

        {receipt.transfer_cost_rub && receipt.transfer_cost_rub > 0 ? (
          <>
            <span className="flex items-center gap-1">
              <Car className="h-3.5 w-3.5 text-primary" />
              Трансфер (туда-обратно):
            </span>
            <span className="text-right font-medium text-foreground">
              {formatPrice(receipt.transfer_cost_rub)}
            </span>
          </>
        ) : null}

        {receipt.train_ticket_rub && receipt.train_ticket_rub > 0 ? (
          <>
            <span className="flex items-center gap-1">
              <Train className="h-3.5 w-3.5 text-primary" />
              Поезд (Tutu.ru{receipt.tickets_count && receipt.tickets_count > 1 ? `, ${receipt.tickets_count} чел.` : ""}):
            </span>
            <span className="text-right font-medium text-foreground">
              {formatPrice(receipt.train_ticket_rub)}
            </span>
          </>
        ) : receipt.flight_ticket_rub && receipt.flight_ticket_rub > 0 ? (
          <>
            <span className="flex items-center gap-1">
              <Plane className="h-3.5 w-3.5 text-primary" />
              Перелет (Aviasales{receipt.tickets_count && receipt.tickets_count > 1 ? `, ${receipt.tickets_count} чел.` : ""}):
            </span>
            <span className="text-right font-medium text-foreground">
              {formatPrice(receipt.flight_ticket_rub)}
            </span>
          </>
        ) : null}
      </div>

      {receipt.total_with_transport_rub && receipt.total_with_transport_rub > receipt.total_rub ? (
        <div className="flex items-center justify-between border-t border-border/80 pt-1.5 text-sm font-bold text-foreground">
          <span>Полный бюджет поездки:</span>
          <span className="text-base font-black text-foreground">
            {formatPrice(receipt.total_with_transport_rub)}
          </span>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-border/50 pt-2 text-xs font-semibold text-success">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>{receipt.cancellation_deadline || "Бесплатная отмена"}</span>
      </div>
    </div>
  );
}
