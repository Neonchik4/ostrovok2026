"use client";

import { Bot, LayoutGrid } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { GhostAction, GhostAgent } from "@/features/ghost-agent";
import { useChatStream } from "@/shared/api";
import { ClassicSerp, FilterState } from "@/widgets/ClassicSerp";

const initialCatalogFilters: FilterState = {
  checkInDate: "2026-10-26",
  checkOutDate: "2026-10-29",
  guests: 2,
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
    hotels,
    transportSummary,
    thoughts,
    isStreaming,
    sendMessage,
  } = useChatStream();

  const currentThought =
    thoughts.length > 0 ? thoughts[thoughts.length - 1].text : null;

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
      {/* Верхняя навигационная панель переключения экранов */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black tracking-tight text-foreground">
            Островок 2026
          </span>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            3-Колоночный Каталог
          </span>
        </div>

        <nav aria-label="Переключатель экранов" className="flex items-center rounded-xl border border-border bg-background p-1 shadow-sm">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold text-muted-foreground transition-all hover:text-foreground"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>AI Консьерж</span>
          </Link>
          <Link
            href="/catalog"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Каталог Островка</span>
          </Link>
        </nav>
      </header>

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

      {/* Интерактивный Ghost-агент: аватар, Action Bar и ThoughtLog */}
      <GhostAgent
        onAction={handleGhostAction}
        onSendPrompt={(prompt) => void sendMessage(prompt)}
        currentThought={currentThought}
        isStreaming={isStreaming}
      />
    </div>
  );
}
