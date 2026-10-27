"use client";

import { Bot, LayoutGrid } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

import { MobileBottomSheet, MobileFloatingBar } from "@/features/mobile-bottom-sheet";
import { decodeTripState, ShareTripButton } from "@/features/share-trip";
import { useChatStream } from "@/shared/api";
import { ChatConcierge } from "@/widgets/ChatConcierge";
import { HotelCanvas } from "@/widgets/HotelCanvas";

export default function HomePage() {
  const {
    messages,
    thoughts,
    hotels,
    chips,
    transportSummary,
    isStreaming,
    isThinking,
    sendMessage,
    stopStream,
  } = useChatStream();

  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [restoredHotelId, setRestoredHotelId] = useState<string | null>(null);
  const hasRestoredRef = useRef(false);

  // Восстановление контекста поездки из URL (?trip=...) (Issue #36)
  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const tripToken = params.get("trip");
    if (!tripToken) return;

    const state = decodeTripState(tripToken);
    if (!state) return;

    hasRestoredRef.current = true;
    if (state.selected_hotel_id) {
      setRestoredHotelId(state.selected_hotel_id);
    }

    const prompt =
      state.user_message ||
      (state.city
        ? `Отели в ${state.city}${state.guests ? ` на ${state.guests} гостей` : ""}`
        : "");

    if (prompt) {
      void sendMessage(prompt, {
        guests: state.guests,
        nights: state.nights,
        pets: state.pet_friendly ? 1 : 0,
      });
    }
  }, [sendMessage]);

  const minPrice =
    hotels.length > 0
      ? Math.min(...hotels.map((h) => h.min_price_per_night_rub))
      : undefined;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* Навигационная панель и кнопка Поделиться (Share Deep-Link) */}
      <nav
        aria-label="Переключатель экранов"
        className="fixed top-4 right-8 z-40 flex items-center gap-2 rounded-xl border border-border bg-card/90 p-1 shadow-lg backdrop-blur-md"
      >
        {hotels.length > 0 && (
          <ShareTripButton
            state={{
              city: hotels[0]?.city,
              selected_hotel_id: restoredHotelId || hotels[0]?.id,
              nights: hotels[0]?.receipt?.nights,
              guests: hotels[0]?.receipt?.tickets_count,
              user_message: hotels[0] ? `Поездка в ${hotels[0].city}` : undefined,
            }}
            label="Поделиться"
            size="sm"
          />
        )}
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow"
        >
          <Bot className="h-3.5 w-3.5" />
          <span>AI Консьерж</span>
        </Link>
        <Link
          href="/catalog"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:text-foreground"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Каталог Островка</span>
        </Link>
      </nav>

      {/* Основной контент: AI Сплит-чат (Чат слева + Витрина отелей справа) */}
      <div className="flex h-full w-full">
        {/* Чат-агент: на мобильных экранах (<1024px) занимает 100% ширины, на десктопе 480px */}
        <ChatConcierge
          messages={messages}
          thoughts={thoughts}
          chips={chips}
          isStreaming={isStreaming}
          isThinking={isThinking}
          onSendMessage={sendMessage}
          onStopStream={stopStream}
        />

        {/* Десктопная витрина отелей (на экранах >=1024px) */}
        <div className="hidden h-full flex-1 min-w-0 lg:flex">
          <HotelCanvas
            hotels={hotels}
            transportSummary={transportSummary}
            isStreaming={isStreaming}
            onSelectPrompt={(prompt) => sendMessage(prompt)}
            initialSelectedHotelId={restoredHotelId}
          />
        </div>
      </div>

      {/* Мобильный плавающий бар с бейджем найденных отелей (Issue #37) */}
      <MobileFloatingBar
        hotelsCount={hotels.length}
        minPrice={minPrice}
        onOpen={() => setIsMobileSheetOpen(true)}
      />

      {/* Мобильная выезжающая шторка (Bottom Sheet) с выдачей отелей (Issue #37) */}
      <MobileBottomSheet
        isOpen={isMobileSheetOpen}
        onClose={() => setIsMobileSheetOpen(false)}
        title="Найденные отели"
        badgeText={hotels.length > 0 ? `${hotels.length}` : undefined}
      >
        <HotelCanvas
          hotels={hotels}
          transportSummary={transportSummary}
          isStreaming={isStreaming}
          onSelectPrompt={(prompt) => {
            setIsMobileSheetOpen(false);
            void sendMessage(prompt);
          }}
          initialSelectedHotelId={restoredHotelId}
        />
      </MobileBottomSheet>
    </div>
  );
}
