"use client";

import { Mic, MicOff, Send, Sparkles } from "lucide-react";
import React, { useState } from "react";

interface ActionBarProps {
  chips?: string[];
  onSelectChip: (chip: string) => void;
  onSubmitPrompt: (prompt: string) => void;
  isListening: boolean;
  onToggleVoice: () => void;
  audioLevels?: number[];
  isThinking?: boolean;
}

const DEFAULT_CHIPS = [
  "Теплый бассейн",
  "С завтраком",
  "До 10 000 ₽",
  "5 звезд",
  "Можно с питомцами",
  "Бесплатная отмена",
];

export function ActionBar({
  chips = DEFAULT_CHIPS,
  onSelectChip,
  onSubmitPrompt,
  isListening,
  onToggleVoice,
  audioLevels = [0.3, 0.6, 0.9, 0.5, 0.2],
  isThinking = false,
}: ActionBarProps) {
  const [inputText, setInputText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSubmitPrompt(inputText.trim());
    setInputText("");
  };

  return (
    <div
      data-testid="ghost-action-bar"
      className="fixed bottom-6 left-1/2 z-40 flex w-full max-w-4xl -translate-x-1/2 items-center gap-3 rounded-3xl border border-border bg-card/95 p-2.5 px-4 shadow-2xl backdrop-blur-xl"
    >
      {/* Лейбл ассистента */}
      <div className="hidden items-center gap-2 pr-2 text-xs font-bold text-primary sm:flex">
        <Sparkles className="h-4 w-4" />
        <span className="whitespace-nowrap">AI Консьерж</span>
      </div>

      {/* Быстрые чипсы действий */}
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {chips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectChip(chip)}
            className="shrink-0 rounded-xl border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Поле текстового ввода */}
      <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-1.5">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Спросите или настройте..."
          className="h-9 w-36 rounded-xl border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:w-48"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isThinking}
          aria-label="Отправить запрос"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>

      {/* Кнопка голосового ввода со звуковой дорожкой */}
      <button
        type="button"
        onClick={onToggleVoice}
        aria-label={isListening ? "Остановить голосовой ввод" : "Включить голосовой ввод"}
        className={`flex h-9 items-center justify-center rounded-xl border px-3 transition-all ${
          isListening
            ? "border-red-500 bg-red-500/20 text-red-400 animate-pulse"
            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
        }`}
      >
        {isListening ? (
          <div className="flex items-center gap-1.5">
            <MicOff className="h-4 w-4" />
            <div className="flex h-3.5 items-center gap-0.5">
              {audioLevels.map((lvl, i) => (
                <span
                  key={i}
                  style={{ height: `${Math.max(4, lvl * 14)}px` }}
                  className="w-0.5 rounded-full bg-red-400 transition-all duration-75"
                />
              ))}
            </div>
          </div>
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
