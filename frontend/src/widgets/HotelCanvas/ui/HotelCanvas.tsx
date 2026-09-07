"use client";

import React, { useState } from "react";
import { HotelCard, Hotel } from "@/entities/hotel";
import { BookRoomModal } from "@/features/book-room";
import { Badge, Button } from "@/shared/ui";
import { Hotel as HotelIcon, SlidersHorizontal, Sparkles, Building2 } from "lucide-react";

interface HotelCanvasProps {
  hotels: Hotel[];
  isStreaming: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

export function HotelCanvas({ hotels, isStreaming, onSelectPrompt }: HotelCanvasProps) {
  const [selectedHotelForBooking, setSelectedHotelForBooking] = useState<Hotel | null>(null);

  return (
    <main className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Шапка канваса */}
      <header className="h-16 shrink-0 border-b border-border px-8 flex items-center justify-between bg-card/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold text-foreground">Витрина отелей</h1>
          </div>
          {hotels.length > 0 && (
            <Badge variant="outline" className="text-xs bg-card border-border text-muted-foreground">
              Найдено {hotels.length} {hotels.length === 1 ? "отель" : hotels.length < 5 ? "отеля" : "отелей"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Сортировка: <strong className="text-foreground">По релевантности (Match Score)</strong></span>
        </div>
      </header>

      {/* Основной контент */}
      <div className="flex-1 overflow-y-auto p-8">
        {hotels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4 text-muted-foreground">
            <div className="p-4 rounded-2xl bg-card border border-border text-primary shadow-sm">
              <HotelIcon className="h-10 w-10 stroke-[1.5]" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">Здесь появятся найденные отели</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Наш AI-агент в реальном времени подбирает идеальные варианты из базы 200 отелей, проверяет доступность номеров и рассчитывает прозрачный чек.
              </p>
            </div>

            {onSelectPrompt && (
              <div className="pt-4 w-full space-y-2">
                <span className="text-xs font-medium text-foreground block">Попробуйте популярные запросы:</span>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPrompt("Красная Поляна на двоих с собакой и теплым бассейном")}
                    className="text-xs justify-start bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-left border-border py-2 h-auto"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary mr-2 shrink-0" />
                    <span>«Красная Поляна на двоих с собакой и теплым бассейном»</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPrompt("Санкт-Петербург 5 звезд с включенным завтраком и спа")}
                    className="text-xs justify-start bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-left border-border py-2 h-auto"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary mr-2 shrink-0" />
                    <span>«Санкт-Петербург 5 звезд с включенным завтраком и спа»</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPrompt("Сочи у моря с бесплатной отменой до 8000 руб")}
                    className="text-xs justify-start bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-left border-border py-2 h-auto"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary mr-2 shrink-0" />
                    <span>«Сочи у моря с бесплатной отменой до 8000 руб»</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {hotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                onBook={(h) => setSelectedHotelForBooking(h)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Модалка бронирования с чеком */}
      <BookRoomModal
        hotel={selectedHotelForBooking}
        onClose={() => setSelectedHotelForBooking(null)}
      />
    </main>
  );
}
