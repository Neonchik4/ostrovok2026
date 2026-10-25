"use client";

import { Activity, X } from "lucide-react";
import React, { useEffect, useRef } from "react";

import { ThoughtStep, ThoughtStepTag } from "../model/types";

interface ThoughtLogProps {
  steps: ThoughtStep[];
  isOpen: boolean;
  onClose: () => void;
}

const TAG_CONFIG: Record<ThoughtStepTag, { label: string; badgeClass: string }> = {
  intent: { label: "ИНТЕНТ", badgeClass: "border-primary/40 bg-primary/15 text-primary" },
  dom: { label: "DOM", badgeClass: "border-purple-500/40 bg-purple-500/15 text-purple-400" },
  action: { label: "ДЕЙСТВИЕ", badgeClass: "border-blue-500/40 bg-blue-500/15 text-blue-400" },
  success: { label: "РЕЗУЛЬТАТ", badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400" },
  scan: { label: "СКАНЕР", badgeClass: "border-warning/40 bg-warning/15 text-warning" },
  error: { label: "ОШИБКА", badgeClass: "border-red-500/40 bg-red-500/15 text-red-400" },
  ai: { label: "GEMINI AI", badgeClass: "border-teal-500/40 bg-teal-500/15 text-teal-300" },
};

export function ThoughtLog({ steps, isOpen, onClose }: ThoughtLogProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  if (!isOpen || steps.length === 0) return null;

  return (
    <aside
      aria-label="Ход мыслей агента"
      data-testid="ghost-thought-log"
      className="fixed bottom-24 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 animate-fade-in rounded-3xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl"
    >
      {/* Шапка панели мыслей */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary animate-pulse" />
          <h4 className="text-xs font-bold tracking-tight text-foreground">
            Ход мыслей агента (SSE Stream)
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Скрыть панель мыслей"
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Список шагов рассуждений */}
      <div
        ref={scrollRef}
        className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1 text-xs"
      >
        {steps.map((step) => {
          const config = TAG_CONFIG[step.tag] || TAG_CONFIG.dom;
          return (
            <div
              key={step.id}
              className="flex items-start gap-2 rounded-xl border border-border/40 bg-background/50 p-2 font-mono"
            >
              <span
                className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${config.badgeClass}`}
              >
                [{config.label}]
              </span>
              <span className="leading-relaxed text-muted-foreground">{step.text}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
