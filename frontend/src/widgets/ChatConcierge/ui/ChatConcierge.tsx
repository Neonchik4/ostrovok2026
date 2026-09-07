"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button, Input, ScrollArea, Badge } from "@/shared/ui";
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
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              О!дин запрос
              <Badge variant="accent" className="text-xs font-semibold py-0.5 px-2">
                AI Concierge
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground font-medium">Персональный подбор отелей</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <span className={`h-2.5 w-2.5 rounded-full ${isStreaming ? "bg-primary animate-ping" : "bg-emerald-400"}`} />
          <span className="text-xs">{isStreaming ? "Рассуждаю..." : "Онлайн"}</span>
        </div>
      </div>

      {/* Область сообщений */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-4 my-auto">
            <div className="p-4 rounded-2xl bg-primary/15 text-primary border border-primary/25 shadow-lg">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-bold text-foreground">Задайте любой запрос</h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Например: «Красная Поляна на двоих с собакой и подогреваемым бассейном до 15 000 ₽» или воспользуйтесь голосовым вводом
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))}
            <ThoughtStream thoughts={thoughts} isStreaming={isStreaming} />
          </>
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
            disabled={isStreaming}
          />

          <Input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Куда и как хотите поехать?..."
            disabled={isStreaming}
            className="flex-1 text-base h-12 px-4 bg-background/80 border-border focus-visible:ring-primary text-foreground placeholder:text-muted-foreground"
          />

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
