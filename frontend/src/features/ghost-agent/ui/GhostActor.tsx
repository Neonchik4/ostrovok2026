"use client";

import { Sparkles, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { GhostCanvasRenderer, GhostState } from "../lib/ghostCanvasRenderer";

interface GhostActorProps {
  mood?: GhostState;
  speechText?: string | null;
  onGhostClick?: () => void;
  isDodgingEnabled?: boolean;
}

export function GhostActor({
  mood = "idle",
  speechText,
  onGhostClick,
  isDodgingEnabled = true,
}: GhostActorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GhostCanvasRenderer | null>(null);

  const [coords, setCoords] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const [isDodging, setIsDodging] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(true);

  // Инициализация Canvas рендерера и отслеживание взгляда
  useEffect(() => {
    if (!canvasRef.current) return;
    let renderer: GhostCanvasRenderer | null = null;
    try {
      renderer = new GhostCanvasRenderer(canvasRef.current);
      rendererRef.current = renderer;
    } catch {
      // JSDOM or environments without canvas 2D support
      rendererRef.current = null;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!renderer) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ghostCenterX = rect.left + rect.width / 2;
      const ghostCenterY = rect.top + rect.height / 2;
      const dx = (e.clientX - ghostCenterX) / (window.innerWidth / 2);
      const dy = (e.clientY - ghostCenterY) / (window.innerHeight / 2);
      renderer.setLookTarget(dx, dy);

      // Физика уклонения от курсора (Evasion Physics):
      // Если привидение смещено от домашней док-станции вглубь страницы и мышь приближается ближе 80px
      if (isDodgingEnabled && coords.x !== null && coords.y !== null && !isDodging) {
        const dist = Math.hypot(e.clientX - coords.x, e.clientY - coords.y);
        if (dist < 80) {
          setIsDodging(true);
          renderer.setState("flying");
          renderer.setTilt(0.2);
          // Возврат в домашний угол
          setTimeout(() => {
            setCoords({ x: null, y: null });
            renderer.setTilt(0);
            renderer.setState("happy");
            setTimeout(() => {
              renderer.setState("idle");
              setIsDodging(false);
            }, 400);
          }, 350);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      renderer?.destroy();
    };
  }, [coords, isDodging, isDodgingEnabled]);

  // Реакция на изменение настроения/режима
  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setState(mood);
  }, [mood]);

  // Показ облачка при обновлении speechText
  useEffect(() => {
    if (speechText) {
      setBubbleVisible(true);
    }
  }, [speechText]);

  const stylePosition =
    coords.x !== null && coords.y !== null
      ? {
          position: "fixed" as const,
          left: `${coords.x}px`,
          top: `${coords.y}px`,
          right: "auto",
          bottom: "auto",
          transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        }
      : {
          position: "fixed" as const,
          right: "24px",
          bottom: "24px",
          transition: "all 0.4s ease",
        };

  return (
    <div
      ref={containerRef}
      style={stylePosition}
      data-testid="ghost-actor-container"
      className="z-40 flex flex-col items-end"
    >
      {/* Облачко речи с автопозиционированием */}
      {bubbleVisible && speechText && (
        <div
          data-testid="ghost-speech-bubble"
          className="relative mb-2 max-w-xs animate-fade-in rounded-2xl border border-primary/30 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setBubbleVisible(false)}
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            aria-label="Закрыть облачко мыслей"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-2 pr-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs font-semibold leading-relaxed text-foreground">
              {speechText}
            </p>
          </div>
        </div>
      )}

      {/* Аватар призрака */}
      <button
        type="button"
        onClick={onGhostClick}
        aria-label="Интерактивный помощник-призрак Островка"
        className="group relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-card/90 p-1 shadow-2xl backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
      >
        <canvas
          ref={canvasRef}
          data-testid="ghost-actor-canvas"
          className="h-14 w-14 cursor-pointer"
          width={64}
          height={64}
        />
      </button>
    </div>
  );
}
