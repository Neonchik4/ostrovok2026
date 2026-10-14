"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button, Input, Logo } from "@/shared/ui";
import { Message } from "@/entities/message";
import { Thought } from "@/entities/thought";
import { VoiceInputButton } from "@/features/voice-input";
import { QuickChips } from "@/features/quick-chips";
import { Send, Square, Database } from "lucide-react";
import { useChatAutoScroll } from "./useChatAutoScroll";
import { ChatMessagesList } from "./ChatMessagesList";

interface ChatConciergeProps {
  messages: Message[];
  thoughts: Thought[];
  chips: string[];
  isStreaming: boolean;
  isThinking?: boolean;
  onSendMessage: (text: string, options?: { disambiguation?: string }) => void;
  onStopStream: () => void;
}

export function ChatConcierge({
  messages,
  thoughts,
  chips,
  isStreaming,
  isThinking,
  onSendMessage,
  onStopStream,
}: ChatConciergeProps) {
  const [inputVal, setInputVal] = useState("");
  const [interimSpeech, setInterimSpeech] = useState("");
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  const { scrollRef, messagesEndRef } = useChatAutoScroll(
    [messages, thoughts],
    isStreaming
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isStreaming || isListeningVoice) return;
    onSendMessage(inputVal.trim());
    setInputVal("");
  };

  const handleVoiceTranscript = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      setIsListeningVoice(false);
      setInterimSpeech("");
      setInputVal("");
      onSendMessage(trimmed);
    }
  };

  return (
    <aside className="flex h-full w-[480px] shrink-0 flex-col overflow-hidden border-r border-border bg-card shadow-2xl">
      {/* Шапка чата */}
      <div className="flex items-center justify-between border-b border-border bg-card/90 p-4 px-5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Logo variant="mark" size={40} className="rounded-xl shadow-md" />
          <div>
            <h2 className="text-base font-bold text-foreground">Агент Островка</h2>
          </div>
        </div>
        <Link href="/studio">
          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground">
            <Database className="h-3.5 w-3.5 mr-1.5 text-primary" /> Studio
          </Button>
        </Link>
      </div>

      {/* Список сообщений и мыслей */}
      <ChatMessagesList
        messages={messages}
        thoughts={thoughts}
        isStreaming={isStreaming}
        isThinking={isThinking}
        scrollRef={scrollRef}
        messagesEndRef={messagesEndRef}
      />

      {/* Быстрые чипсы уточнений */}
      {chips.length > 0 && (
        <div className="border-t border-border bg-background/50 px-5 backdrop-blur-sm">
          <QuickChips
            chips={chips}
            disabled={isStreaming}
            onSelectChip={(chip) => onSendMessage("", { disambiguation: chip })}
          />
        </div>
      )}

      {/* Форма ввода */}
      <div className="border-t border-border bg-card p-4 px-5">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            onInterimTranscript={setInterimSpeech}
            onListeningChange={setIsListeningVoice}
            disabled={isStreaming}
          />

          <div className="relative flex-1">
            <Input
              value={isListeningVoice && interimSpeech ? interimSpeech : inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={
                isListeningVoice
                  ? "Слушаю вас, говорите... (ввод текста заблокирован)"
                  : "Куда и как хотите поехать?..."
              }
              maxLength={500}
              disabled={isStreaming || isListeningVoice}
              readOnly={isListeningVoice}
              className={`h-12 w-full border-border bg-background/80 px-4 text-base text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary ${
                isListeningVoice ? "cursor-not-allowed border-primary/60 opacity-80" : ""
              }`}
            />

            {isListeningVoice && (
              <span className="absolute right-3 top-1/2 flex h-2.5 w-2.5 -translate-y-1/2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
            )}
          </div>

          {isStreaming ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={onStopStream}
              title="Остановить генерацию"
              className="h-12 w-12 rounded-xl"
            >
              <Square className="h-5 w-5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!inputVal.trim() || isListeningVoice || isStreaming}
              className="h-12 w-12 rounded-xl bg-primary text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              title="Отправить"
            >
              <Send className="h-5 w-5" />
            </Button>
          )}
        </form>
      </div>
    </aside>
  );
}
