"use client";

import React, { useState } from "react";
import { Thought } from "../model/types";
import { Sparkles, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface ThoughtStreamProps {
  thoughts: Thought[];
  isStreaming: boolean;
  isThinking?: boolean;
}

export function ThoughtStream({ thoughts, isStreaming, isThinking }: ThoughtStreamProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (thoughts.length === 0) return null;

  const totalSteps = thoughts.length;
  // Если передан isThinking — используем его, иначе опираемся на isStreaming
  const activeThinking = isThinking !== undefined ? isThinking : isStreaming;
  // Прогресс: при активном рассуждении последний шаг ещё в процессе
  const completedSteps = activeThinking ? Math.max(0, totalSteps - 1) : totalSteps;
  const expectedSteps = 5;
  const progressPct = Math.min(100, Math.round((completedSteps / expectedSteps) * 100));

  return (
    <div
      className="mb-4 overflow-hidden rounded-2xl border border-border bg-card/80 text-sm shadow-sm backdrop-blur-md"
      aria-live="polite"
      aria-label="Ход рассуждений агента"
    >
      {/* Заголовок — кликабелен для collapse/expand */}
      <button
        type="button"
        onClick={() => setIsCollapsed((c) => !c)}
        className="flex w-full select-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2">
          <Sparkles className={`h-4 w-4 text-primary ${activeThinking ? "animate-pulse" : ""}`} />
          Ход рассуждений агента
          {!activeThinking ? (
            <span className="ml-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary shadow-sm">
              {totalSteps} шагов
            </span>
          ) : (
            <span className="ml-1.5 rounded-md border border-primary/30 bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary shadow-sm">
              Шаг {Math.min(totalSteps, expectedSteps)} из {expectedSteps}...
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
        <div className="mx-0 h-0.5 w-full bg-border">
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
            const isLatest = idx === thoughts.length - 1 && activeThinking;

            return (
              <div
                key={`${item.step}-${idx}`}
                className="flex animate-fade-in items-start gap-2.5 transition-all duration-200"
              >
                {/* Статус-иконка: строго либо спиннер у активного шага, либо галочка у завершённого */}
                <div className="mt-0.5 shrink-0">
                  {isLatest ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Check className="h-4 w-4 text-emerald-400" />
                  )}
                </div>

                {/* Чистый текст без зачёркивания и без вторичных значков */}
                <span
                  className={
                    isLatest
                      ? "font-medium leading-relaxed text-foreground"
                      : "leading-relaxed text-muted-foreground"
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
