"use client";

import React, { useState } from "react";
import { HotelCard, Hotel } from "@/entities/hotel";
import { HotelDetailModal } from "@/features/hotel-details";
import { Badge, Button } from "@/shared/ui";
import { Hotel as HotelIcon, SlidersHorizontal, Sparkles, Building2 } from "lucide-react";

interface HotelCanvasProps {
  hotels: Hotel[];
  isStreaming: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

export function HotelCanvas({ hotels, isStreaming, onSelectPrompt }: HotelCanvasProps) {
  const [selectedHotelForDetails, setSelectedHotelForDetails] = useState<Hotel | null>(null);

  return (
    <main className="flex h-full flex-1 min-w-0 flex-col overflow-hidden bg-background">
      {/* Шапка канваса */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-border bg-card/60 px-8 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-foreground md:text-2xl">
              Витрина отелей
            </h1>
          </div>
          {hotels.length > 0 && (
            <Badge
              variant="outline"
              className="border-border bg-card px-3 py-1 text-sm font-semibold text-primary shadow-sm"
            >
              Найдено {hotels.length}{" "}
              {hotels.length === 1 ? "отель" : hotels.length < 5 ? "отеля" : "отелей"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span>
            Сортировка: <strong className="text-foreground">По релевантности (Match Score)</strong>
          </span>
        </div>
      </header>

      {/* Основной контент */}
      <div className="flex-1 min-h-0 overflow-y-auto p-8 hotel-canvas-scroll">
        {hotels.length === 0 ? (
          <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center space-y-6 text-center text-muted-foreground">
            <div className="rounded-3xl border border-border bg-card p-5 text-primary shadow-xl">
              <HotelIcon className="h-14 w-14 stroke-[1.5]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground md:text-3xl">
                Здесь появятся найденные отели
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                Наш AI-агент в реальном времени подбирает идеальные варианты из базы 2 600+ отелей
                Островка, проверяет доступность номеров и рассчитывает прозрачный чек.
              </p>
            </div>

            {onSelectPrompt && (
              <div className="w-full space-y-3 pt-2">
                <span className="block pl-1 text-left text-sm font-bold uppercase tracking-wider text-foreground">
                  Попробуйте популярные запросы:
                </span>
                <div className="flex flex-col gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onSelectPrompt("Красная Поляна на двоих с собакой и теплым бассейном")
                    }
                    className="h-auto justify-start rounded-xl border-border bg-card px-4 py-3.5 text-left text-base shadow-sm transition-all hover:border-primary/40 hover:bg-primary/15 hover:text-primary"
                  >
                    <Sparkles className="mr-3 h-5 w-5 shrink-0 text-primary" />
                    <span>«Красная Поляна на двоих с собакой и теплым бассейном»</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onSelectPrompt("Санкт-Петербург 5 звезд с включенным завтраком и спа")
                    }
                    className="h-auto justify-start rounded-xl border-border bg-card px-4 py-3.5 text-left text-base shadow-sm transition-all hover:border-primary/40 hover:bg-primary/15 hover:text-primary"
                  >
                    <Sparkles className="mr-3 h-5 w-5 shrink-0 text-primary" />
                    <span>«Санкт-Петербург 5 звезд с включенным завтраком и спа»</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPrompt("Сочи у моря с бесплатной отменой до 8000 руб")}
                    className="h-auto justify-start rounded-xl border-border bg-card px-4 py-3.5 text-left text-base shadow-sm transition-all hover:border-primary/40 hover:bg-primary/15 hover:text-primary"
                  >
                    <Sparkles className="mr-3 h-5 w-5 shrink-0 text-primary" />
                    <span>«Сочи у моря с бесплатной отменой до 8000 руб»</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {hotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                onSelect={(h) => setSelectedHotelForDetails(h)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Детальная модалка с реальными отзывами гостей */}
      <HotelDetailModal
        hotel={selectedHotelForDetails}
        onClose={() => setSelectedHotelForDetails(null)}
      />
    </main>
  );
}
