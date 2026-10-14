import React from "react";

import { ChatMessageItem, Message } from "@/entities/message";
import { Thought,ThoughtStream } from "@/entities/thought";
import { Logo } from "@/shared/ui";

interface ChatMessagesListProps {
  messages: Message[];
  thoughts: Thought[];
  isStreaming: boolean;
  isThinking?: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessagesList({
  messages,
  thoughts,
  isStreaming,
  isThinking,
  scrollRef,
  messagesEndRef,
}: ChatMessagesListProps) {
  const isEmpty = messages.length === 0 && thoughts.length === 0;

  if (isEmpty) {
    return (
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col items-center justify-center p-6 text-center overflow-hidden"
      >
        <Logo variant="mark" size={48} className="rounded-2xl mb-3" />
        <h3 className="text-lg font-bold text-foreground">О!дин запрос — и отель найден</h3>
        <p className="mt-2 max-w-[280px] text-sm text-muted-foreground">
          Назовите город, даты, компанию или пожелания (например: «Красная Поляна с собакой и
          спа до 15 000 ₽»).
        </p>
        <div ref={messagesEndRef} className="sr-only" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 px-5">

      {/* История сообщений до текущего ответа */}
      {(messages[messages.length - 1]?.role === "assistant"
        ? messages.slice(0, -1)
        : messages
      ).map((msg) => (
        <ChatMessageItem key={msg.id} message={msg} />
      ))}

      {/* Стрим рассуждений агента */}
      {thoughts.length > 0 && (
        <ThoughtStream thoughts={thoughts} isStreaming={isStreaming} isThinking={isThinking} />
      )}

      {/* Ответ агента (строго ниже хода рассуждений) */}
      {messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
        <ChatMessageItem
          key={messages[messages.length - 1].id}
          message={messages[messages.length - 1]}
        />
      )}

      {/* Якорь для автопрокрутки к концу сообщений */}
      <div ref={messagesEndRef} className="h-1 w-full shrink-0" aria-hidden="true" />
    </div>
  );
}
