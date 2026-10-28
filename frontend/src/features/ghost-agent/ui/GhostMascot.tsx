"use client";

import { Mic, MicOff, Sparkles, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { GhostCanvasRenderer } from "../lib/ghostCanvasRenderer";

interface GhostMascotProps {
  currentThought?: string | null;
  isStreaming?: boolean;
  onSendPrompt?: (text: string) => void;
}

export function GhostMascot({
  currentThought,
  isStreaming = false,
  onSendPrompt,
}: GhostMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GhostCanvasRenderer | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [bubbleText, setBubbleText] = useState<string>("Привет! Чем могу помочь?");
  const [isBubbleVisible, setIsBubbleVisible] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new GhostCanvasRenderer(canvasRef.current);
    rendererRef.current = renderer;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ghostCenterX = rect.left + rect.width / 2;
      const ghostCenterY = rect.top + rect.height / 2;
      const dx = (e.clientX - ghostCenterX) / (window.innerWidth / 2);
      const dy = (e.clientY - ghostCenterY) / (window.innerHeight / 2);
      renderer.setLookTarget(dx, dy);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      renderer.destroy();
    };
  }, []);

  useEffect(() => {
    if (!rendererRef.current) return;

    if (isListening) {
      rendererRef.current.setState("speaking");
      setBubbleText("Слушаю вас... Говорите!");
      setIsBubbleVisible(true);
    } else if (isStreaming) {
      rendererRef.current.setState("thinking");
      if (currentThought) {
        setBubbleText(currentThought);
        setIsBubbleVisible(true);
      }
    } else {
      rendererRef.current.setState("idle");
    }
  }, [isListening, isStreaming, currentThought]);

  const toggleVoice = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setBubbleText("Голосовой ввод не поддерживается в этом браузере");
      setIsBubbleVisible(true);
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
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && onSendPrompt) {
          rendererRef.current?.setState("happy");
          setBubbleText(`Ищу: «${transcript}»`);
          onSendPrompt(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleGhostClick = () => {
    if (rendererRef.current) {
      rendererRef.current.setState("happy");
      setTimeout(() => {
        rendererRef.current?.setState(isStreaming ? "thinking" : "idle");
      }, 1500);
    }
    setBubbleText("Я ваш голосовой агент Островка. Нажмите микрофон или напишите запрос!");
    setIsBubbleVisible(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Облачко мыслей и речи */}
      {isBubbleVisible && (
        <div className="relative mb-2 max-w-xs animate-fade-in rounded-2xl border border-primary/30 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setIsBubbleVisible(false)}
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            aria-label="Закрыть подсказку"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-2 pr-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs font-medium leading-relaxed text-foreground">
              {bubbleText}
            </p>
          </div>
        </div>
      )}

      {/* Контейнер привидения и быстрых кнопок */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleVoice}
          title={isListening ? "Остановить запись" : "Голосовой помощник"}
          className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-all ${
            isListening
              ? "animate-pulse border-red-500 bg-red-500/20 text-red-400"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={handleGhostClick}
          className="group relative flex h-16 w-16 items-center justify-center transition-transform hover:scale-105 hover:drop-shadow-[0_0_14px_hsl(var(--primary)/0.35)] active:scale-95"
          title="Ваш AI-агент Ostrovok"
        >
          <canvas
            ref={canvasRef}
            className="h-14 w-14 cursor-pointer"
            width={64}
            height={64}
          />
        </button>
      </div>
    </div>
  );
}
