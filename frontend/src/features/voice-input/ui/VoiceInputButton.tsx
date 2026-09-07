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
      className={isListening ? "animate-pulse" : ""}
    >
      {isListening ? (
        <MicOff className="h-4 w-4 text-white" />
      ) : (
        <Mic className="h-4 w-4 text-primary" />
      )}
    </Button>
  );
}
