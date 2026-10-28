"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { GhostCanvasRenderer, GhostState } from "../lib/ghostCanvasRenderer";
import { parseGhostIntent } from "../lib/ghostIntentRouter";
import { GhostAction, ThoughtStep } from "../model/types";
import { ActionBar } from "./ActionBar";
import { GhostActor } from "./GhostActor";
import { ThoughtLog } from "./ThoughtLog";

interface GhostAgentProps {
  onAction?: (action: GhostAction) => void;
  onSendPrompt?: (prompt: string) => void;
  currentThought?: string | null;
  isStreaming?: boolean;
}

export function GhostAgent({
  onAction,
  onSendPrompt,
  currentThought,
  isStreaming = false,
}: GhostAgentProps) {
  const [mood, setMood] = useState<GhostState>("idle");
  const [speechText, setSpeechText] = useState<string>("Привет! Чем могу помочь?");
  const [thoughtSteps, setThoughtSteps] = useState<ThoughtStep[]>([]);
  const [isThoughtLogOpen, setIsThoughtLogOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Синхронизация мыслей из внешнего потока SSE
  useEffect(() => {
    if (isStreaming) {
      setMood("thinking");
      if (currentThought) {
        setSpeechText(currentThought);
        setThoughtSteps((prev) => [
          ...prev,
          {
            id: `stream-${Date.now()}`,
            tag: "ai",
            text: currentThought,
            timestamp: Date.now(),
          },
        ]);
        setIsThoughtLogOpen(true);
      }
    } else {
      setMood("idle");
    }
  }, [isStreaming, currentThought]);

  const handleQuery = useCallback(
    (query: string) => {
      const result = parseGhostIntent(query);
      setThoughtSteps((prev) => [...prev, ...result.thoughts]);
      setIsThoughtLogOpen(true);
      setSpeechText(result.speechText);
      setMood("happy");

      setTimeout(() => {
        setMood("idle");
      }, 1800);

      if (result.handled && result.action) {
        onAction?.(result.action);
      } else if (onSendPrompt) {
        onSendPrompt(query);
      }
    },
    [onAction, onSendPrompt]
  );

  const toggleVoice = () => {
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechText("Голосовой ввод не поддерживается в этом браузере");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setMood("speaking");
        setSpeechText("Слушаю вас... Говорите!");
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          handleQuery(transcript);
        }
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleGhostClick = () => {
    setMood("happy");
    setSpeechText("Я ваш интерактивный AI-агент Островка!");
    setTimeout(() => setMood("idle"), 1500);
  };

  return (
    <>
      <ThoughtLog
        steps={thoughtSteps}
        isOpen={isThoughtLogOpen}
        onClose={() => setIsThoughtLogOpen(false)}
      />

      <ActionBar
        onSelectChip={handleQuery}
        onSubmitPrompt={handleQuery}
        isListening={isListening}
        onToggleVoice={toggleVoice}
        isThinking={isStreaming}
      />

      <GhostActor
        mood={mood}
        speechText={speechText}
        onGhostClick={handleGhostClick}
      />
    </>
  );
}

export { GhostCanvasRenderer };
