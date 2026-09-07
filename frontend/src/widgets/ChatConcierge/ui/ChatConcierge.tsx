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
    <aside className="w-[420px] shrink-0 border-r border-border bg-card flex flex-col h-full overflow-hidden">
      {/* Шапка чата */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/20 shadow-sm">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              О!дин запрос
              <Badge variant="accent" className="text-[10px] py-0 px-1.5 h-4">
                AI Concierge
              </Badge>
            </h2>
            <p className="text-[11px] text-muted-foreground">Персональный подбор отелей</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${isStreaming ? "bg-primary animate-ping" : "bg-emerald-400"}`} />
          <span className="text-[11px]">{isStreaming ? "Рассуждаю..." : "Онлайн"}</span>
        </div>
      </div>

      {/* Область сообщений */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-3 my-auto">
            <div className="p-3 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Задайте любой запрос</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Например: «Красная Поляна на двоих с собакой и подогреваемым бассейном до 15 000 ₽» или используйте микрофон
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
        <div className="px-4 border-t border-border bg-background/30">
          <QuickChips
            chips={chips}
            disabled={isStreaming}
            onSelectChip={(chip) => onSendMessage("", { disambiguation: chip })}
          />
        </div>
      )}

      {/* Форма ввода */}
      <div className="p-4 border-t border-border bg-card">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            disabled={isStreaming}
          />

          <Input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Куда и как хотите поехать?..."
            disabled={isStreaming}
            className="flex-1 text-xs bg-background/60 border-border focus-visible:ring-primary"
          />

          {isStreaming ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={onStopStream}
              title="Остановить генерацию"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!inputVal.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              title="Отправить"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </aside>
  );
}
