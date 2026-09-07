"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button, Input } from "@/shared/ui";
import { ChatMessageItem, Message } from "@/entities/message";
import { ThoughtStream, Thought } from "@/entities/thought";
import { VoiceInputButton } from "@/features/voice-input";
import { QuickChips } from "@/features/quick-chips";
import { Send, Square, Sparkles, Compass } from "lucide-react";

interface ChatConciergeProps {
  messages: Message[];
  thoughts: Thought[];
  chips: string[];
  isStreaming: boolean;
  onSendMessage: (text: string, options?: { disambiguation?: string }) => void;
  onStopStream: () => void;
}

export function ChatConcierge({
  messages,
  thoughts,
  chips,
  isStreaming,
  onSendMessage,
  onStopStream,
}: ChatConciergeProps) {
  const [inputVal, setInputVal] = useState("");
  const [interimSpeech, setInterimSpeech] = useState("");
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thoughts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isStreaming) return;
    onSendMessage(inputVal);
    setInputVal("");
  };

  const handleVoiceTranscript = (text: string) => {
    if (text.trim()) {
      setInputVal(text);
      onSendMessage(text);
      setInputVal("");
      setInterimSpeech("");
    }
  };

  return (
    <aside className="w-[480px] shrink-0 border-r border-border bg-card flex flex-col h-full overflow-hidden shadow-2xl">
      {/* Шапка чата */}
      <div className="p-4 px-5 border-b border-border flex items-center justify-between bg-card/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-md">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Консьерж Островок</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              AI Агент онлайн • Детерминированный чек
            </p>
          </div>
        </div>
      </div>

      {/* Список сообщений и мыслей */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 px-5 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-foreground text-lg">О!дин запрос — и отель найден</h3>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              Назовите город, даты, компанию или пожелания (например: «Красная Поляна с собакой и спа до 15 000 ₽»).
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}

        {/* Стрим рассуждений */}
        {thoughts.length > 0 && (
          <ThoughtStream thoughts={thoughts} isStreaming={isStreaming} />
        )}
      </div>

      {/* Быстрые чипсы уточнений */}
      {chips.length > 0 && (
        <div className="px-5 border-t border-border bg-background/50 backdrop-blur-sm">
          <QuickChips
            chips={chips}
            disabled={isStreaming}
            onSelectChip={(chip) => onSendMessage("", { disambiguation: chip })}
          />
        </div>
      )}

      {/* Форма ввода */}
      <div className="p-4 px-5 border-t border-border bg-card">
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
                  ? "Слушаю вас, говорите..."
                  : "Куда и как хотите поехать?..."
              }
              disabled={isStreaming}
              className={`text-base h-12 px-4 bg-background/80 border-border focus-visible:ring-primary text-foreground placeholder:text-muted-foreground w-full transition-all ${
                isListeningVoice ? "border-primary/60 ring-1 ring-primary/40" : ""
              }`}
            />
            {isListeningVoice && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
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
              disabled={!inputVal.trim()}
              className="h-12 w-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all"
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
