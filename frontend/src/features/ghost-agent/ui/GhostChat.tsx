"use client";

import { ChevronDown, Mic, MicOff, Send } from "lucide-react";
import React, { forwardRef, useState } from "react";

import { cn } from "@/shared/lib/utils";

import { GhostChatMessage } from "../model/types";
import styles from "./ghostAgent.module.css";

interface GhostChatProps {
  messages: GhostChatMessage[];
  onSubmitPrompt: (prompt: string) => void;
  isListening: boolean;
  onToggleVoice: () => void;
  isThinking?: boolean;
  onClose: () => void;
}

/**
 * Компактное окно чата с Ghost (288px, высота по содержимому), над логотипом Яндекс.Карт.
 * Призрак садится на шапку окна — он рисуется отдельным летающим слоем в GhostAgent.
 */
export const GhostChat = forwardRef<HTMLElement, GhostChatProps>(function GhostChat(
  { messages, onSubmitPrompt, isListening, onToggleVoice, isThinking = false, onClose },
  ref
) {
  const [inputText, setInputText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    onSubmitPrompt(text);
    setInputText("");
  };

  return (
    <section
      ref={ref}
      aria-label="Чат с Ghost"
      className={cn(
        styles.chatIn,
        "fixed bottom-14 right-6 z-40 flex w-72 flex-col rounded-[18px] border border-border bg-card shadow-[0_16px_48px_rgba(17,24,39,0.18)]"
      )}
    >
      <div className="relative flex h-14 shrink-0 items-center gap-2 rounded-t-[18px] border-b border-border bg-accent/40 pl-[86px] pr-1.5">
        <span
          aria-hidden="true"
          className={cn(styles.shadow, "absolute left-6 top-[30px] h-1.5 w-10 rounded-full")}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <h3 className="text-sm font-bold text-foreground">Ghost</h3>
          <span className="text-xs text-muted-foreground">AI-агент каталога</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Скрыть чат"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* column-reverse держит ленту прижатой к последним репликам, остальное — скроллом */}
      <div
        role="log"
        aria-label="История диалога с Ghost"
        className={cn(styles.messages, "flex max-h-[148px] flex-col-reverse overflow-y-auto p-3")}
      >
        <div className="flex flex-col gap-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] px-3 py-2 text-[13px] leading-[1.45]",
                message.role === "user"
                  ? "self-end rounded-[14px_14px_4px_14px] bg-primary text-primary-foreground"
                  : "self-start rounded-[14px_14px_14px_4px] bg-muted text-foreground"
              )}
            >
              {message.text}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex shrink-0 gap-1.5 border-t border-border p-2.5">
        <label htmlFor="ghost-chat-input" className="sr-only">
          Сообщение Ghost
        </label>
        <input
          id="ghost-chat-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isListening ? "Слушаю…" : "Сообщение…"}
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-muted/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggleVoice}
          aria-label="Голосовой ввод"
          aria-pressed={isListening}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
            isListening
              ? "animate-pulse border-destructive bg-alert-bg text-alert"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
          )}
        >
          {isListening ? (
            <MicOff className="h-[18px] w-[18px]" />
          ) : (
            <Mic className="h-[18px] w-[18px]" />
          )}
        </button>
        <button
          type="submit"
          aria-label="Отправить"
          disabled={!inputText.trim() || isThinking}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
});
