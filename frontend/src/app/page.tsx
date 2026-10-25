"use client";

import { Bot, LayoutGrid } from "lucide-react";
import React, { useState } from "react";

import { GhostMascot } from "@/features/ghost-agent";
import { useChatStream } from "@/shared/api";
import { ChatConcierge } from "@/widgets/ChatConcierge";
import { ClassicSerp } from "@/widgets/ClassicSerp";
import { HotelCanvas } from "@/widgets/HotelCanvas";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<"split" | "classic">("split");

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

  const currentThought =
    thoughts.length > 0 ? thoughts[thoughts.length - 1].text : null;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* Переключатель режимов: AI Сплит-чат vs Классический Островок */}
      <nav aria-label="Режимы отображения" className="fixed top-4 right-8 z-40 flex items-center rounded-xl border border-border bg-card/90 p-1 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={() => setViewMode("split")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
            viewMode === "split"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
          <span>AI Сплит-чат</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode("classic")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
            viewMode === "classic"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Классический Островок</span>
        </button>
      </nav>

      {/* Основной контент в зависимости от выбранного режима */}
      {viewMode === "split" ? (
        <div className="flex h-full w-full">
          {/* Левая колонка (420px): Чат-агент */}
          <ChatConcierge
            messages={messages}
            thoughts={thoughts}
            chips={chips}
            isStreaming={isStreaming}
            isThinking={isThinking}
            onSendMessage={sendMessage}
            onStopStream={stopStream}
          />

          {/* Правая колонка (flex-1): Канвас отелей */}
          <HotelCanvas
            hotels={hotels}
            transportSummary={transportSummary}
            isStreaming={isStreaming}
            onSelectPrompt={(prompt) => sendMessage(prompt)}
          />
        </div>
      ) : (
        /* Режим Классического Островка: 3 колонки (фильтры, отели, карта) + интерактивный помощник-привидение */
        <>
          <ClassicSerp
            hotels={hotels}
            transportSummary={transportSummary}
            onSendQuery={(query) => sendMessage(query)}
          />
          <GhostMascot
            currentThought={currentThought}
            isStreaming={isStreaming}
            onSendPrompt={(prompt) => sendMessage(prompt)}
          />
        </>
      )}
    </div>
  );
}
