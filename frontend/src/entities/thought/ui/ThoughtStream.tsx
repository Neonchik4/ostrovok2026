"use client";

import React, { useState } from "react";
import { Thought } from "../model/types";
import {
  Sparkles,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ThoughtStreamProps {
  thoughts: Thought[];
  isStreaming: boolean;
}

export function ThoughtStream({ thoughts, isStreaming }: ThoughtStreamProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (thoughts.length === 0) return null;

  const totalSteps = thoughts.length;
  // Прогресс: при стриминге последний шаг ещё в процессе
  const completedSteps = isStreaming ? Math.max(0, totalSteps - 1) : totalSteps;
  const expectedSteps = 5;
  const progressPct = Math.min(100, Math.round((completedSteps / expectedSteps) * 100));

  return (
    <div
      className="rounded-2xl border border-border bg-card/80 text-sm mb-4 backdrop-blur-md shadow-sm overflow-hidden"
      aria-live="polite"
      aria-label="Ход рассуждений агента"
    >
      {/* Заголовок — кликабелен для collapse/expand */}
      <button
        type="button"
        onClick={() => setIsCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 font-bold text-primary text-sm hover:bg-primary/5 transition-colors select-none"
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2">
          <Sparkles className={`h-4 w-4 ${isStreaming ? "animate-pulse" : ""}`} />
          Ход рассуждений агента
          {!isStreaming && (
            <span className="text-xs font-normal text-muted-foreground ml-1.5">
              {totalSteps} шагов
            </span>
          )}
        </span>
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Прогресс-бар */}
      {!isCollapsed && (
        <div className="h-0.5 w-full bg-border mx-0">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      )}

      {/* Список шагов */}
      {!isCollapsed && (
        <div className="space-y-2.5 px-4 py-3 pl-3">
          {thoughts.map((item, idx) => {
            const isLatest = idx === thoughts.length - 1 && isStreaming;

            return (
              <div
                key={idx}
                className="flex items-start gap-2.5 animate-fade-in"
              >
                {/* Статус-иконка: пока данный шаг текущий — показывает спиннер, иначе — галочку */}
                <div className="shrink-0 mt-0.5">
                  {isLatest ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Check className="h-4 w-4 text-emerald-400" />
                  )}
                </div>

                {/* Текст шага мыслей */}
                <span
                  className={
                    isLatest
                      ? "text-foreground font-medium leading-relaxed"
                      : "text-muted-foreground leading-relaxed"
                  }
                >
                  {item.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

