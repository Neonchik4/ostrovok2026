"use client";

import React from "react";

import { ONBOARDING_SCENARIOS } from "../model/scenarios";

interface OnboardingScenarioChipsProps {
  /** Колбэк запуска поискового потока агента сформулированным запросом сценария. */
  onSelectScenario: (query: string) => void;
  /** Блокировка на время активного стрима. */
  disabled?: boolean;
}

/**
 * Чипсы быстрых сценариев на стартовом экране (Issue #41, F01).
 * Показываются в пустом чате над полем ввода: один клик запускает
 * полноценный поисковый поток агента без ручного ввода текста.
 * Визуал — только векторные иконки Lucide, без эмодзи и HEX-цветов.
 */
export function OnboardingScenarioChips({
  onSelectScenario,
  disabled,
}: OnboardingScenarioChipsProps) {
  return (
    <div
      data-testid="onboarding-scenarios"
      className="border-t border-border bg-background/50 px-5 py-4 backdrop-blur-sm"
    >
      <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        С чего начнём поездку?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ONBOARDING_SCENARIOS.map((scenario, idx) => {
          const Icon = scenario.icon;
          const isWide = idx === ONBOARDING_SCENARIOS.length - 1;
          return (
            <button
              key={scenario.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectScenario(scenario.query)}
              className={`group flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all duration-150 hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40 ${
                isWide ? "col-span-2" : ""
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-foreground">
                  {scenario.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {scenario.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
