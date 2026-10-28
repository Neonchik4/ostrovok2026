"use client";

import React, { useEffect, useRef, useState } from "react";

import { MobileBottomSheet, MobileFloatingBar } from "@/features/mobile-bottom-sheet";
import { decodeTripState, ShareTripButton, toCompactHotelSnapshot } from "@/features/share-trip";
import { HotelData, useChatStream } from "@/shared/api";
import { AppHeader } from "@/widgets/AppHeader";
import { ChatAgent } from "@/widgets/ChatAgent";
import { HotelCanvas } from "@/widgets/HotelCanvas";

export default function HomePage() {
  const {
    messages,
    thoughts,
    hotels,
    chips,
    transportSummary,
    offlineMode,
    isStreaming,
    isThinking,
    sendMessage,
    stopStream,
    restoreSharedTrip,
  } = useChatStream();

  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [restoredHotelId, setRestoredHotelId] = useState<string | null>(null);
  const hasRestoredRef = useRef(false);

  // Восстановление контекста поездки из URL (?trip=...) без повторного расчета
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

    // Если в ссылке уже есть сохраненные отели — восстанавливаем их сразу без повторного расчета
    if (state.hotels && state.hotels.length > 0) {
      const topHotel = state.hotels[0];
      const assistantText =
        state.assistant_message ||
        `Вот готовая поездка, которой с вами поделились: ${topHotel?.name || state.city}${state.nights ? ` на ${state.nights} ноч.` : ""}. Все расчеты и условия сохранены.`;

      restoreSharedTrip({
        hotels: state.hotels as HotelData[],
        userMessage: state.user_message || (state.city ? `Поездка в ${state.city}` : undefined),
        assistantMessage: assistantText,
        transportSummary: state.transport_summary,
      });
      return;
    }

    // Если передан только ID отеля — загружаем его статически без вызова LLM
    if (state.selected_hotel_id) {
      fetch(`/api/hotels/${encodeURIComponent(state.selected_hotel_id)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((hotel) => {
          if (hotel) {
            restoreSharedTrip({
              hotels: [hotel as HotelData],
              userMessage: state.user_message || `Отель «${hotel.name}» в ${hotel.city}`,
              assistantMessage:
                state.assistant_message ||
                `Вот готовая сохраненная поездка в отель «${hotel.name}» (${hotel.city}).`,
            });
          }
        })
        .catch(() => {});
      return;
    }

    // Фоллбэк только для пустых ссылок без отелей
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
  }, [sendMessage, restoreSharedTrip]);

  const minPrice =
    hotels.length > 0
      ? Math.min(...hotels.map((h) => h.min_price_per_night_rub))
      : undefined;

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      <AppHeader
        title="Агент Островка"
        offlineNotice={offlineMode}
        action={
          hotels.length > 0 ? (
            <ShareTripButton
              state={{
                city: hotels[0]?.city,
                selected_hotel_id: restoredHotelId || hotels[0]?.id,
                nights: hotels[0]?.receipt?.nights,
                guests: hotels[0]?.receipt?.tickets_count,
                user_message:
                  messages.find((m) => m.role === "user")?.content ||
                  (hotels[0] ? `Поездка в ${hotels[0].city}` : undefined),
                assistant_message:
                  messages.filter((m) => m.role === "assistant").slice(-1)[0]?.content ||
                  (hotels[0]
                    ? `Вот готовая подборка отелей в ${hotels[0].city}: лучший вариант — ${hotels[0].name}.`
                    : undefined),
                hotels: hotels.slice(0, 5).map(toCompactHotelSnapshot),
                transport_summary: transportSummary,
              }}
              label="Поделиться"
              size="sm"
            />
          ) : undefined
        }
      />

      {/* Основной контент: AI Сплит-чат (Чат-агент слева + Витрина отелей справа) */}
      <div className="flex min-h-0 w-full flex-1">
        {/* Чат-агент: на мобильных экранах (<1024px) занимает 100% ширины, на десктопе 480px */}
        <ChatAgent
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
            onSelectPrompt={(prompt) => void sendMessage(prompt)}
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
