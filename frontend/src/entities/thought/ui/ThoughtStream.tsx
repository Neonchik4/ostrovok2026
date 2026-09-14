"use client";

import React, { useState } from "react";
import { Thought } from "../model/types";
import { Sparkles, Check, Loader2, ChevronDown, ChevronUp, X } from "lucide-react";

interface ThoughtStreamProps {
  thoughts: Thought[];
  isStreaming: boolean;
  isThinking?: boolean;
}

export function ThoughtStream({ thoughts, isStreaming, isThinking }: ThoughtStreamProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (thoughts.length === 0) return null;

  const totalSteps = thoughts.length;
  const hasError = thoughts.some(
    (t) =>
      t.step === "error" ||
      t.text.startsWith("Ошибка:") ||
      t.text.includes("(сбой)") ||
      t.text.toLowerCase().includes("ошибка")
  );
  const isCancelled = thoughts.some(
    (t) =>
      t.step === "cancelled" ||
      t.step === "stopped" ||
      t.text.toLowerCase().includes("остановлен") ||
      t.text.toLowerCase().includes("прерван")
  );

  const isFailedOrStopped = hasError || isCancelled;
  // Если передан isThinking — используем его, иначе опираемся на isStreaming (при ошибке/остановке процесс прекращается)
  const activeThinking = !isFailedOrStopped && (isThinking !== undefined ? isThinking : isStreaming);
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
          {hasError ? (
            <span className="ml-1.5 rounded-md border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive shadow-sm">
              Сбой
            </span>
          ) : isCancelled ? (
            <span className="ml-1.5 rounded-md border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive shadow-sm">
              Остановлено
            </span>
          ) : !activeThinking ? (
            <span className="ml-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary shadow-sm">
              {totalSteps} шагов
            </span>
          ) : (
            <span className="ml-1.5 rounded-md border border-primary/30 bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary shadow-sm">
              Шаг {Math.min(totalSteps, expectedSteps)} из {expectedSteps}
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
            className={`h-full transition-all duration-300 ease-out ${
              isFailedOrStopped ? "bg-destructive" : "bg-primary"
            }`}
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
            const isStepError =
              item.step === "error" ||
              item.text.startsWith("Ошибка:") ||
              item.text.includes("(сбой)") ||
              item.text.toLowerCase().includes("ошибка");

            const isStepCancelled =
              item.step === "cancelled" ||
              item.step === "stopped" ||
              item.text.toLowerCase().includes("остановлен") ||
              item.text.toLowerCase().includes("прерван");

            // Шаг считается прерванным сбоем только если следующим элементом идёт системное сообщение об ошибке
            const nextItem = thoughts[idx + 1];
            const isInterruptedByError = Boolean(
              nextItem &&
                (nextItem.step === "error" || nextItem.text.startsWith("Ошибка:")) &&
                !item.text.startsWith("Ошибка:")
            );

            // Если стрим был остановлен пользователем и это последний шаг, он не завершён
            const isUnfinishedCancelledLast =
              idx === thoughts.length - 1 && isCancelled;

            const isFailed =
              isStepError ||
              isStepCancelled ||
              isInterruptedByError ||
              isUnfinishedCancelledLast;

            const isLatest = idx === thoughts.length - 1 && activeThinking && !isFailed;

            return (
              <div
                key={`${item.step}-${idx}`}
                className="flex animate-fade-in items-start gap-2.5 transition-all duration-200"
              >
                {/* Статус-иконка: сбой/остановка (красный крестик), спиннер (активный шаг) или галочка (завершенный шаг) */}
                <div className="mt-0.5 shrink-0">
                  {isFailed ? (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                      <X className="h-3 w-3 stroke-[2.5]" />
                    </div>
                  ) : isLatest ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Check className="h-4 w-4 text-emerald-400" />
                  )}
                </div>

                {/* Текст шага мыслей */}
                <span
                  className={
                    isFailed
                      ? "font-medium leading-relaxed text-destructive"
                      : isLatest
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

