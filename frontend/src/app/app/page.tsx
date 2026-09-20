"use client";

import React from "react";
import { useChatStream } from "@/shared/api";
import { ChatConcierge } from "@/widgets/ChatConcierge";
import { HotelCanvas } from "@/widgets/HotelCanvas";

export default function AppSearchPage() {
  const { messages, thoughts, hotels, chips, isStreaming, isThinking, sendMessage, stopStream } =
    useChatStream();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Левая колонка (480px): Чат-консьерж */}
      <ChatConcierge
        messages={messages}
        thoughts={thoughts}
        chips={chips}
        isStreaming={isStreaming}
        isThinking={isThinking}
        onSendMessage={sendMessage}
        onStopStream={stopStream}
      />

      {/* Правая колонка: Канвас отелей */}
      <HotelCanvas
        hotels={hotels}
        isStreaming={isStreaming}
        onSelectPrompt={(prompt) => sendMessage(prompt)}
      />
    </div>
  );
}
