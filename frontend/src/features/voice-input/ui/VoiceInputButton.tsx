"use client";

import React, { useEffect } from "react";
import { Button } from "@/shared/ui";
import { useVoiceInput } from "../model/useVoiceInput";
import { useAudioVisualizer } from "../model/useAudioVisualizer";
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
  const { isListening, isSupported, interimTranscript, toggleListening, stopListening } =
    useVoiceInput(onTranscript);
  const audioLevels = useAudioVisualizer(isListening, { numBars: 5, minHeight: 0.2 });

  useEffect(() => {
    onInterimTranscript?.(interimTranscript);
  }, [interimTranscript, onInterimTranscript]);

  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  // При блокировке (например, началась генерация ответа isStreaming = true):
  // сразу же отключаем микрофон, чтобы он не висел включенным
  useEffect(() => {
    if (disabled && isListening) {
      stopListening();
    }
  }, [disabled, isListening, stopListening]);

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
          {/* Динамическая звуковая дорожка эквалайзера в такт с реальным вводом */}
          <div className="flex items-center gap-0.5 h-6">
            {audioLevels.map((level, idx) => (
              <span
                key={idx}
                className="w-1 bg-white rounded-full transition-[height] duration-75 ease-out"
                style={{
                  height: `${Math.max(4, Math.round(level * 22))}px`,
                }}
              />
            ))}
          </div>
          <MicOff className="h-4 w-4 text-white/90 shrink-0" />
        </div>
      ) : (
        <Mic className="h-5 w-5 text-primary" />
      )}
    </Button>
  );
}

