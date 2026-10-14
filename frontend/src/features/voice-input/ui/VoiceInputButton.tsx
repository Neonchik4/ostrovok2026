"use client";

import { Mic, MicOff } from "lucide-react";
import React, { useEffect } from "react";

import { Button } from "@/shared/ui";

import { useAudioVisualizer } from "../model/useAudioVisualizer";
import { useVoiceInput } from "../model/useVoiceInput";

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
      title={isListening ? "Остановить голосовой ввод" : "Голосовой ввод запроса (Web Speech API)"}
      className={`h-12 shrink-0 rounded-xl transition-all duration-300 ${
        isListening
          ? "w-20 bg-destructive text-white shadow-lg shadow-destructive/20 hover:bg-destructive/90"
          : "w-12 border-border bg-card hover:border-primary/40 hover:bg-primary/20"
      }`}
    >
      {isListening ? (
        <div className="flex w-full items-center justify-center gap-1.5">
          {/* Динамическая звуковая дорожка эквалайзера в такт с реальным вводом */}
          <div className="flex h-6 items-center gap-0.5">
            {audioLevels.map((level, idx) => (
              <span
                key={idx}
                className="w-1 rounded-full bg-white transition-[height] duration-75 ease-out"
                style={{
                  height: `${Math.max(4, Math.round(level * 22))}px`,
                }}
              />
            ))}
          </div>
          <MicOff className="h-4 w-4 shrink-0 text-white/90" />
        </div>
      ) : (
        <Mic className="h-5 w-5 text-primary" />
      )}
    </Button>
  );
}
