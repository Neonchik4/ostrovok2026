import React from "react";
import { ChatMessageItem, Message } from "@/entities/message";
import { ThoughtStream, Thought } from "@/entities/thought";
import { Sparkles } from "lucide-react";

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
  return (
    <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 px-5">
      {messages.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center space-y-3 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Один запрос — и отель найден</h3>
          <p className="max-w-[280px] text-sm text-muted-foreground">
            Назовите город, даты, компанию или пожелания (например: «Красная Поляна с собакой и спа
            до 15 000 ₽»).
          </p>
        </div>
      )}

      {/* История сообщений до текущего ответа */}
      {(messages[messages.length - 1]?.role === "assistant" ? messages.slice(0, -1) : messages).map(
        (msg) => (
          <ChatMessageItem key={msg.id} message={msg} />
        )
      )}

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
