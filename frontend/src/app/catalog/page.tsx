"use client";

import React, { useEffect, useRef, useState } from "react";

import { GhostAction, GhostAgent } from "@/features/ghost-agent";
import { useChatStream } from "@/shared/api";
import { AppHeader } from "@/widgets/AppHeader";
import { ClassicSerp, FilterState } from "@/widgets/ClassicSerp";

const initialCatalogFilters: FilterState = {
  sort: "match",
  breakfast: false,
  pool: false,
  spa: false,
  pets: false,
  freeCancellation: false,
  minStars: null,
  maxPrice: null,
};

export default function CatalogPage() {
  const [filters, setFilters] = useState<FilterState>(initialCatalogFilters);
  const [highlightedHotelId, setHighlightedHotelId] = useState<string | null>(null);

  const {
    messages = [],
    hotels,
    transportSummary,
    isCacheRestored,
    thoughts,
    isStreaming,
    sendMessage,
  } = useChatStream();

  const currentThought =
    thoughts.length > 0 ? thoughts[thoughts.length - 1].text : null;

  const lastAssistantMessage =
    messages.filter((m) => m.role === "assistant").slice(-1)[0]?.content || null;

  const hasLoadedInitialRef = useRef(false);
  useEffect(() => {
    if (hasLoadedInitialRef.current || !isCacheRestored) return;
    if (hotels.length === 0 && !isStreaming) {
      hasLoadedInitialRef.current = true;
      void sendMessage("Популярные отели в Сочи и на Красной Поляне");
    }
  }, [hotels.length, isCacheRestored, isStreaming, sendMessage]);

  const handleGhostAction = (action: GhostAction) => {
    switch (action.type) {
      case "toggle_filter":
        if (action.key) {
          setFilters((prev) => ({
            ...prev,
            [action.key as keyof FilterState]: Boolean(action.value),
          }));
        }
        break;
      case "set_price":
        setFilters((prev) => ({
          ...prev,
          maxPrice: typeof action.value === "number" ? action.value : null,
        }));
        break;
      case "set_stars":
        setFilters((prev) => ({
          ...prev,
          minStars: typeof action.value === "number" ? action.value : null,
        }));
        break;
      case "reset":
        setFilters(initialCatalogFilters);
        setHighlightedHotelId(null);
        break;
      case "select_hotel":
        if (hotels.length > 0) {
          setHighlightedHotelId(hotels[0].id);
        }
        break;
      case "prompt":
        if (action.text) {
          void sendMessage(action.text);
        }
        break;
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Единая шапка с переключателем экранов */}
      <AppHeader title="Каталог Островка" />

      {/* 3-колоночный симулятор Островка (Фильтры + Список + Карта) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ClassicSerp
          hotels={hotels}
          transportSummary={transportSummary}
          filters={filters}
          onFilterChange={setFilters}
          highlightedHotelId={highlightedHotelId}
          onSelectHotel={(hotel) => setHighlightedHotelId(hotel.id)}
        />
      </div>

      {/* Плавающий Ghost-агент: призрак в углу и компактный чат поверх карты */}
      <GhostAgent
        onAction={handleGhostAction}
        onSendPrompt={(prompt) => void sendMessage(prompt)}
        currentThought={currentThought}
        assistantMessage={lastAssistantMessage}
        isStreaming={isStreaming}
      />
    </div>
  );
}
