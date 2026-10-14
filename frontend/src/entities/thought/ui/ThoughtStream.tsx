"use client";

import { Check, ChevronDown, Loader2, Sparkles, X } from "lucide-react";
import React, { useState } from "react";

import {
  Badge,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Progress,
} from "@/shared/ui";

import { Thought } from "../model/types";

interface ThoughtStreamProps {
  thoughts: Thought[];
  isStreaming: boolean;
  isThinking?: boolean;
  defaultCollapsed?: boolean;
}

function parseThoughtText(text: string): { summary: string; detail: string } {
  const dotsIdx = text.indexOf("...");
  if (dotsIdx !== -1 && dotsIdx <= 80 && dotsIdx + 3 < text.length) {
    const summary = text.slice(0, dotsIdx + 3).trim();
    const detail = text.slice(dotsIdx + 3).trim();
    if (detail.length > 0) return { summary, detail };
  }
  return { summary: text, detail: "" };
}

export function ThoughtStream({
  thoughts,
  isStreaming,
  isThinking,
  defaultCollapsed = true,
}: ThoughtStreamProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

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
  const activeThinking =
    !isFailedOrStopped && (isThinking !== undefined ? isThinking : isStreaming);
  const completedSteps = activeThinking ? Math.max(0, totalSteps - 1) : totalSteps;
  const expectedSteps = 5;
  const progressPct = Math.min(100, Math.round((completedSteps / expectedSteps) * 100));

  const latestThought = thoughts[thoughts.length - 1];
  const { summary: latestSummary } = parseThoughtText(latestThought?.text ?? "");

  return (
    <Card
      className="mb-4 overflow-hidden border-border/80 bg-card/75 text-sm shadow-sm backdrop-blur-md transition-all duration-200"
      aria-live="polite"
      aria-label="Ход рассуждений агента"
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full select-none items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus:outline-none"
            aria-expanded={isOpen}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles
                  className={`h-3.5 w-3.5 ${
                    activeThinking ? "animate-pulse text-primary" : "text-primary/80"
                  }`}
                />
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 font-medium text-foreground">
                  {activeThinking ? "Рассуждаю..." : "Ход рассуждений агента"}
                </span>

                {!isOpen && activeThinking && (
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline-block">
                    {latestSummary}
                  </span>
                )}
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {hasError ? (
                  <Badge variant="destructive">Сбой</Badge>
                ) : isCancelled ? (
                  <Badge variant="destructive">Остановлено</Badge>
                ) : activeThinking ? (
                  <Badge variant="accent">
                    Шаг {Math.min(totalSteps, expectedSteps)} из {expectedSteps}
                  </Badge>
                ) : (
                  <Badge variant="outline">{totalSteps} шагов</Badge>
                )}
              </div>
            </div>

            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>

        {/* Прогресс-бар рассуждений shadcn/ui */}
        <Progress
          value={isFailedOrStopped ? 100 : progressPct}
          className={`h-0.5 rounded-none ${
            isFailedOrStopped ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"
          }`}
        />

        {/* Список шагов рассуждений */}
        <CollapsibleContent>
          <div className="max-h-64 space-y-3 overflow-y-auto p-4 pt-3.5">
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

              const nextItem = thoughts[idx + 1];
              const isInterruptedByError = Boolean(
                nextItem &&
                  (nextItem.step === "error" || nextItem.text.startsWith("Ошибка:")) &&
                  !item.text.startsWith("Ошибка:")
              );

              const isUnfinishedCancelledLast =
                idx === thoughts.length - 1 && isCancelled;

              const isFailed =
                isStepError ||
                isStepCancelled ||
                isInterruptedByError ||
                isUnfinishedCancelledLast;

              const isLatest = idx === thoughts.length - 1 && activeThinking && !isFailed;
              const { summary, detail } = parseThoughtText(item.text);

              return (
                <div
                  key={`${item.step}-${idx}`}
                  className="flex items-start gap-2.5 text-xs transition-opacity duration-200"
                >
                  <div className="mt-0.5 shrink-0">
                    {isFailed ? (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                        <X className="h-3 w-3 stroke-[2.5]" />
                      </div>
                    ) : isLatest ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-success-bg text-success">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 leading-relaxed">
                    <span
                      className={
                        isFailed
                          ? "font-medium text-destructive"
                          : isLatest
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                      }
                    >
                      {detail && !isFailed ? summary : item.text}
                    </span>

                    {/* Дополнительная детализация шага (без простыни текста) */}
                    {detail && !isFailed && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground hover:line-clamp-none transition-all">
                        {detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
