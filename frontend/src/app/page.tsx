"use client";

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
    isStreaming,
    sendMessage,
    stopStream,
  } = useChatStream();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Левая колонка (420px): Чат-консьерж */}
      <ChatConcierge
        messages={messages}
        thoughts={thoughts}
        chips={chips}
        isStreaming={isStreaming}
        onSendMessage={sendMessage}
        onStopStream={stopStream}
      />

      {/* Правая колонка (1020px / flex-1): Канвас отелей */}
      <HotelCanvas
        hotels={hotels}
        isStreaming={isStreaming}
        onSelectPrompt={(prompt) => sendMessage(prompt)}
      />
    </div>
  );
}
