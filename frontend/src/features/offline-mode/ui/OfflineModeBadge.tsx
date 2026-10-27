"use client";

import { WifiOff } from "lucide-react";
import React from "react";

interface OfflineModeBadgeProps {
  /** Сообщение автономного режима из SSE-события mode. Пустое значение — бейдж скрыт. */
  message?: string | null;
}

/**
 * Статусная плашка Zero-Config Offline Mode (Issue #46).
 * Показывается, когда агент работает без внешних API — на локальном
 * эвристическом движке. Только дизайн-токены, без HEX и эмодзи.
 */
export function OfflineModeBadge({ message }: OfflineModeBadgeProps) {
  if (!message) return null;

  return (
    <span
      data-testid="offline-mode-badge"
      title={message}
      className="inline-flex max-w-[280px] items-center gap-1.5 rounded-full border border-warning/40 bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning transition-colors"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{message}</span>
    </span>
  );
}
