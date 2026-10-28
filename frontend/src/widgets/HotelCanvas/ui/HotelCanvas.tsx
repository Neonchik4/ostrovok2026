"use client";

import { ArrowLeft, Building2, Hotel as HotelIcon, Sparkles } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Hotel, HotelCard } from "@/entities/hotel";
import { HotelDetailView } from "@/features/hotel-details";
import { TransportSummaryData } from "@/shared/api";
import { Badge, Button } from "@/shared/ui";

import { HotelTransportBanner } from "./HotelTransportBanner";

interface HotelCanvasProps {
  hotels: Hotel[];
  transportSummary?: TransportSummaryData | null;
  isStreaming: boolean;
  onSelectPrompt?: (prompt: string) => void;
  initialSelectedHotelId?: string | null;
}

export function HotelCanvas({
  hotels,
  transportSummary,
  isStreaming: _isStreaming,
  onSelectPrompt,
  initialSelectedHotelId,
}: HotelCanvasProps) {
  const [mode, setMode] = useState<"list" | "detail">("list");
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);

  useEffect(() => {
    if (initialSelectedHotelId && hotels.length > 0) {
      const match = hotels.find((h) => h.id === initialSelectedHotelId);
      if (match) {
        setSelectedHotel(match);
        setMode("detail");
      }
    }
  }, [initialSelectedHotelId, hotels]);

  const handleSelectHotel = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setMode("detail");
  };

  const handleBackToList = () => {
    setMode("list");
  };

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
{mode === "detail" && selectedHotel ? selectedHotel.name : "Витрина отелей"}
            </h1>
          </div>
          {mode === "list" && hotels.length > 0 && (
            <Badge
              variant="outline"
              className="border-border bg-card px-3 py-1 text-sm font-semibold text-primary shadow-sm"
            >
              Найдено {hotels.length}{" "}
              {hotels.length === 1 ? "отель" : hotels.length < 5 ? "отеля" : "отелей"}
            </Badge>
          )}
        </div>
        {mode === "detail" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToList}
            className="h-10 gap-1.5 rounded-xl border-border bg-card px-4 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад ко всем отелям</span>
          </Button>
        )}
      </header>

      {/* Основной контент */}
      <div className="flex-1 min-h-0 overflow-y-auto p-8 hotel-canvas-scroll">
{mode === "detail" && selectedHotel ? (
          <HotelDetailView
            hotel={selectedHotel}
            transport={transportSummary}
            onBack={handleBackToList}
          />
        ) : hotels.length === 0 ? (
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
                      onSelectPrompt("Санкт-Петербург центр 4 звезды до 12000 руб")
                    }
                    className="h-auto justify-start rounded-xl border-border bg-card px-4 py-3.5 text-left text-base shadow-sm transition-all hover:border-primary/40 hover:bg-primary/15 hover:text-primary"
                  >
                    <Sparkles className="mr-3 h-5 w-5 shrink-0 text-primary" />
                    <span>«Санкт-Петербург центр 4 звезды до 12000 руб»</span>
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
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Карточка маршрута и билетов */}
            {transportSummary && (transportSummary.recommended_flight || transportSummary.recommended_train) && (
              <HotelTransportBanner transport={transportSummary} />
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {hotels.map((hotel) => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  isSelected={selectedHotel?.id === hotel.id}
                  onSelect={handleSelectHotel}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
