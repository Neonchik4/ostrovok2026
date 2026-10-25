"use client";

import { Bot, LayoutGrid } from "lucide-react";
import Link from "next/link";
import React from "react";

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

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* Переключатель экранов: AI Консьерж ( / ) <-> Каталог Островка ( /catalog ) */}
      <nav
        aria-label="Переключатель экранов"
        className="fixed top-4 right-8 z-40 flex items-center rounded-xl border border-border bg-card/90 p-1 shadow-lg backdrop-blur-md"
      >
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

      {/* Основной контент: AI Сплит-чат (Чат-агент слева + Витрина отелей справа) */}
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

        {/* Правая колонка (flex-1): Канвас отелей с инлайн детальным просмотром */}
        <HotelCanvas
          hotels={hotels}
          transportSummary={transportSummary}
          isStreaming={isStreaming}
          onSelectPrompt={(prompt) => sendMessage(prompt)}
        />
      </div>
    </div>
  );
}
