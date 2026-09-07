"use client";

import React, { useEffect } from "react";
import { Button } from "@/shared/ui";
import { useVoiceInput } from "../model/useVoiceInput";
import { Mic, MicOff } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onListeningChange?: (active: boolean) => void;
  disabled?: boolean;
}

export function VoiceInputButton({
  onTranscript,
  onInterimTranscript,
  onListeningChange,
  disabled,
}: VoiceInputButtonProps) {
  const { isListening, isSupported, interimTranscript, toggleListening } =
    useVoiceInput(onTranscript);

  useEffect(() => {
    onInterimTranscript?.(interimTranscript);
  }, [interimTranscript, onInterimTranscript]);

  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  // Пока isSupported = false (SSR + первый клиентский рендер):
  // рендерим прозрачный placeholder того же размера h-12 w-12.
  if (!isSupported) {
    return <div className="h-12 w-12 shrink-0" aria-hidden="true" />;
  }

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      onClick={toggleListening}
      disabled={disabled}
      title={
        isListening
          ? "Остановить голосовой ввод"
          : "Голосовой ввод запроса (Web Speech API)"
      }
      className={`h-12 rounded-xl shrink-0 transition-all duration-300 ${
        isListening
          ? "w-20 bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20"
          : "w-12 bg-card border-border hover:bg-primary/20 hover:border-primary/40"
      }`}
    >
      {isListening ? (
        <div className="flex items-center justify-center gap-1.5 w-full">
          {/* Анимированная звуковая дорожка эквалайзера (Gemini style) */}
          <div className="flex items-center gap-0.5 h-6">
            <span className="w-1 bg-white rounded-full h-5 animate-wave-1" />
            <span className="w-1 bg-white rounded-full h-5 animate-wave-2" />
            <span className="w-1 bg-white rounded-full h-5 animate-wave-3" />
            <span className="w-1 bg-white rounded-full h-5 animate-wave-4" />
            <span className="w-1 bg-white rounded-full h-5 animate-wave-5" />
          </div>
          <MicOff className="h-4 w-4 text-white/90 shrink-0" />
        </div>
      ) : (
        <Mic className="h-5 w-5 text-primary" />
      )}
    </Button>
  );
}

