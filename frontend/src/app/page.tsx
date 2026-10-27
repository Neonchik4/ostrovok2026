"use client";

import React from "react";

import { useChatStream } from "@/shared/api";
import { AppHeader } from "@/widgets/AppHeader";
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
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      <AppHeader title="Агент Островка" />

      {/* Основной контент: AI Сплит-чат (Чат-агент слева + Витрина отелей справа) */}
      <div className="flex min-h-0 w-full flex-1">
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
