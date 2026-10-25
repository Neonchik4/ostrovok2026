import { ExternalLink, Plane, Train } from "lucide-react";
import React from "react";

import { TransportSummaryData } from "@/shared/api";
import { formatPrice } from "@/shared/lib";

interface HotelTransportBannerProps {
  transport: TransportSummaryData;
}

export function HotelTransportBanner({ transport }: HotelTransportBannerProps) {
  const isTrainPref = transport.preferred_mode === "train";

  const flightBlock = transport.recommended_flight && (
    <div className={`flex items-center gap-3 ${isTrainPref ? "border-border md:border-l md:pl-4" : ""}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
        !isTrainPref ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary/50 text-foreground"
      }`}>
        <Plane className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Авиаперелет:</span>
          <span className="text-sm font-bold text-foreground">{transport.recommended_flight.airline}</span>
          <span className={`text-xs font-semibold ${!isTrainPref ? "text-primary" : "text-foreground"}`}>
            от {formatPrice(transport.recommended_flight.price_rub)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {transport.origin_city} → {transport.destination_city} • Прилет ~{transport.arrival_time || "13:45"}
        </p>
      </div>
    </div>
  );

  const trainBlock = transport.recommended_train && (
    <div className={`flex items-center gap-3 ${!isTrainPref ? "border-border md:border-l md:pl-4" : ""}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
        isTrainPref ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary/50 text-foreground"
      }`}>
        <Train className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Поезд:</span>
          <span className="text-sm font-bold text-foreground">{transport.recommended_train.train_number}</span>
          <span className={`text-xs font-semibold ${isTrainPref ? "text-primary" : "text-foreground"}`}>
            от {formatPrice(transport.recommended_train.price_from_rub)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {transport.origin_city} → {transport.destination_city} • 14:40 → 08:15
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-card/90 p-4 shadow-lg backdrop-blur-md md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        {isTrainPref ? (
          <>
            {trainBlock}
            {flightBlock}
          </>
        ) : (
          <>
            {flightBlock}
            {trainBlock}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isTrainPref ? (
          <>
            {transport.recommended_train && (
              <a
                href={transport.recommended_train.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
              >
                <Train className="h-3.5 w-3.5" />
                <span>Ж/Д билет (Tutu.ru)</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {transport.recommended_flight && (
              <a
                href={transport.recommended_flight.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/70 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Plane className="h-3.5 w-3.5" />
                <span>Авиабилет (Aviasales)</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        ) : (
          <>
            {transport.recommended_flight && (
              <a
                href={transport.recommended_flight.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
              >
                <Plane className="h-3.5 w-3.5" />
                <span>Авиабилет (Aviasales)</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {transport.recommended_train && (
              <a
                href={transport.recommended_train.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/70 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Train className="h-3.5 w-3.5" />
                <span>Ж/Д билет (Tutu.ru)</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
