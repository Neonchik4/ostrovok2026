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
      <header className="h-20 shrink-0 border-b border-border px-8 flex items-center justify-between bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/25">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight">Витрина отелей</h1>
          </div>
          {hotels.length > 0 && (
            <Badge variant="outline" className="text-sm font-semibold px-3 py-1 bg-card border-border text-primary shadow-sm">
              Найдено {hotels.length} {hotels.length === 1 ? "отель" : hotels.length < 5 ? "отеля" : "отелей"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span>Сортировка: <strong className="text-foreground">По релевантности (Match Score)</strong></span>
        </div>
      </header>

      {/* Основной контент */}
      <div className="flex-1 overflow-y-auto p-8">
        {hotels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6 text-muted-foreground">
            <div className="p-5 rounded-3xl bg-card border border-border text-primary shadow-xl">
              <HotelIcon className="h-14 w-14 stroke-[1.5]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-foreground">Здесь появятся найденные отели</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Наш AI-агент в реальном времени подбирает идеальные варианты из базы 200 отелей, проверяет доступность номеров и рассчитывает прозрачный чек.
              </p>
            </div>

            {onSelectPrompt && (
              <div className="pt-2 w-full space-y-3">
                <span className="text-sm font-bold text-foreground block uppercase tracking-wider text-left pl-1">
                  Попробуйте популярные запросы:
                </span>
                <div className="flex flex-col gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPrompt("Красная Поляна на двоих с собакой и теплым бассейном")}
                    className="text-base justify-start bg-card hover:bg-primary/15 hover:text-primary hover:border-primary/40 text-left border-border py-3.5 px-4 h-auto rounded-xl shadow-sm transition-all"
                  >
                    <Sparkles className="h-5 w-5 text-primary mr-3 shrink-0" />
                    <span>«Красная Поляна на двоих с собакой и теплым бассейном»</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPrompt("Санкт-Петербург 5 звезд с включенным завтраком и спа")}
                    className="text-base justify-start bg-card hover:bg-primary/15 hover:text-primary hover:border-primary/40 text-left border-border py-3.5 px-4 h-auto rounded-xl shadow-sm transition-all"
                  >
                    <Sparkles className="h-5 w-5 text-primary mr-3 shrink-0" />
                    <span>«Санкт-Петербург 5 звезд с включенным завтраком и спа»</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPrompt("Сочи у моря с бесплатной отменой до 8000 руб")}
                    className="text-base justify-start bg-card hover:bg-primary/15 hover:text-primary hover:border-primary/40 text-left border-border py-3.5 px-4 h-auto rounded-xl shadow-sm transition-all"
                  >
                    <Sparkles className="h-5 w-5 text-primary mr-3 shrink-0" />
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
