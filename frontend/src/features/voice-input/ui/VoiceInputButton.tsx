"use client";

import React from "react";
import { Button } from "@/shared/ui";
import { useVoiceInput } from "../model/useVoiceInput";
import { Mic, MicOff } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const { isListening, isSupported, toggleListening } = useVoiceInput(onTranscript);

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      onClick={toggleListening}
      disabled={disabled}
      title={isListening ? "Остановить запись" : "Голосовой ввод запроса (Web Speech API)"}
      className={`h-12 w-12 rounded-xl shrink-0 ${isListening ? "animate-pulse" : "bg-card border-border hover:bg-primary/20 hover:border-primary/40"}`}
    >
      {isListening ? (
        <MicOff className="h-5 w-5 text-white" />
      ) : (
        <Mic className="h-5 w-5 text-primary" />
      )}
    </Button>
  );
}
