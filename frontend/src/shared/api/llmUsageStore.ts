"use client";

import { useSyncExternalStore } from "react";

/** Один оплачиваемый вызов LLM API — событие SSE llm_usage (контракт в AGENTS.md §5). */
export interface LlmCallUsage {
  stage: string;
  model: string;
  /** Токены из ответа Gemini; null — API их не вернул. */
  input_tokens: number | null;
  cached_tokens: number | null;
  /** Включая токены размышлений — так их тарифицирует Google. */
  output_tokens: number | null;
  thinking_tokens: number | null;
  total_tokens: number | null;
  /** Время до первого токена; null у вызовов без стриминга. */
  ttft_ms: number | null;
  duration_ms: number;
  output_tokens_per_sec: number | null;
  streamed: boolean;
  /** Ответ из кэша Cloudflare AI Gateway: до Google не дошёл, cost_usd = 0. */
  gateway_cache_hit: boolean;
  /** null — нет токенов или модели нет в прайсе: цену не угадываем. */
  cost_usd: number | null;
}

interface LlmPricingInfo {
  source: string;
  updated: string;
}

export interface LlmUsagePayload {
  calls: LlmCallUsage[];
  /** null — USD_RUB_RATE на сервере не задан. */
  usd_rub_rate: number | null;
  pricing?: LlmPricingInfo | null;
}

/** Запрос пользователя в чат и все вызовы LLM, которые он породил. */
export interface LlmRequestUsage {
  id: string;
  message: string;
  page: string;
  startedAt: string;
  calls: LlmCallUsage[];
  usdRubRate: number | null;
  pricing?: LlmPricingInfo | null;
}

export type LlmRequestMeta = Pick<LlmRequestUsage, "id" | "message" | "page" | "startedAt">;

// Сессия = вкладка браузера: переживает переходы между / и /catalog и перезагрузку
export const LLM_USAGE_STORAGE_KEY = "ostrovok:llm-usage";

let requests: LlmRequestUsage[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function persist() {
  try {
    if (requests.length === 0) sessionStorage.removeItem(LLM_USAGE_STORAGE_KEY);
    else sessionStorage.setItem(LLM_USAGE_STORAGE_KEY, JSON.stringify(requests));
  } catch {
    // sessionStorage недоступен (приватный режим) — живём в памяти
  }
}

/** Подтягивает сессию из sessionStorage (новая загрузка страницы в той же вкладке). */
export function restoreLlmUsage(): void {
  try {
    const raw = sessionStorage.getItem(LLM_USAGE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    requests = Array.isArray(parsed) ? (parsed as LlmRequestUsage[]) : [];
  } catch {
    requests = [];
  }
  emit();
}

if (typeof window !== "undefined") restoreLlmUsage();

/** Добавляет вызовы из события llm_usage к своему запросу; новые запросы — первыми. */
export function appendLlmUsage(meta: LlmRequestMeta, payload: LlmUsagePayload): void {
  const calls = Array.isArray(payload.calls) ? payload.calls : [];
  const existing = requests.find((request) => request.id === meta.id);
  const updated: LlmRequestUsage = existing
    ? { ...existing, calls: [...existing.calls, ...calls] }
    : { ...meta, calls, usdRubRate: null };
  updated.usdRubRate = payload.usd_rub_rate ?? updated.usdRubRate;
  updated.pricing = payload.pricing ?? updated.pricing;

  requests = [updated, ...requests.filter((request) => request.id !== meta.id)];
  persist();
  emit();
}

export function clearLlmUsage(): void {
  requests = [];
  persist();
  emit();
}

export function getLlmUsageSnapshot(): LlmRequestUsage[] {
  return requests;
}

const EMPTY: LlmRequestUsage[] = [];

export function useLlmUsage(): LlmRequestUsage[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getLlmUsageSnapshot,
    () => EMPTY
  );
}
