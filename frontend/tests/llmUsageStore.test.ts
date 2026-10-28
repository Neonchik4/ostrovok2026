import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendLlmUsage,
  clearLlmUsage,
  getLlmUsageSnapshot,
  LLM_USAGE_STORAGE_KEY,
  LlmCallUsage,
  restoreLlmUsage,
  useChatStream,
} from "@/shared/api";

const call = (overrides: Partial<LlmCallUsage> = {}): LlmCallUsage => ({
  stage: "response",
  model: "gemini-3.5-flash-lite",
  input_tokens: 100,
  cached_tokens: 0,
  output_tokens: 20,
  thinking_tokens: 0,
  total_tokens: 120,
  ttft_ms: 300,
  duration_ms: 800,
  output_tokens_per_sec: 40,
  gateway_cache_hit: false,
  streamed: true,
  cost_usd: 0.00008,
  ...overrides,
});

const meta = { id: "req-1", message: "Сочи у моря", page: "/", startedAt: "2026-10-28T10:00:00.000Z" };
const pricing = { source: "https://ai.google.dev/gemini-api/docs/pricing", updated: "2026-10-27" };

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  };
}

beforeEach(() => {
  sessionStorage.clear();
  clearLlmUsage();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("llmUsageStore (сессия вкладки)", () => {
  it("groups usage events of one chat request and keeps the latest request first", () => {
    appendLlmUsage(meta, { calls: [call({ stage: "slots", ttft_ms: null })], usd_rub_rate: 80, pricing });
    appendLlmUsage(meta, { calls: [call()], usd_rub_rate: 80, pricing });
    appendLlmUsage(
      { ...meta, id: "req-2", page: "/catalog" },
      { calls: [call()], usd_rub_rate: 80, pricing }
    );

    const [latest, first] = getLlmUsageSnapshot();
    expect(latest.id).toBe("req-2");
    expect(latest.page).toBe("/catalog");
    expect(first.calls.map((c) => c.stage)).toEqual(["slots", "response"]);
    expect(first.usdRubRate).toBe(80);
    expect(first.pricing).toEqual(pricing);
  });

  it("persists to sessionStorage and restores after a page reload or navigation", () => {
    appendLlmUsage(meta, { calls: [call()], usd_rub_rate: 80, pricing });
    expect(sessionStorage.getItem(LLM_USAGE_STORAGE_KEY)).toContain("req-1");

    const saved = sessionStorage.getItem(LLM_USAGE_STORAGE_KEY);
    clearLlmUsage();
    sessionStorage.setItem(LLM_USAGE_STORAGE_KEY, saved as string);
    restoreLlmUsage();

    expect(getLlmUsageSnapshot().map((r) => r.id)).toEqual(["req-1"]);
  });

  it("clears the session", () => {
    appendLlmUsage(meta, { calls: [call()], usd_rub_rate: 80, pricing });
    clearLlmUsage();

    expect(getLlmUsageSnapshot()).toEqual([]);
    expect(sessionStorage.getItem(LLM_USAGE_STORAGE_KEY)).toBeNull();
  });
});

describe("useChatStream → llm_usage", () => {
  it("records real LLM usage from the SSE stream for the request and page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          'event: thought\ndata: {"step": "reasoning", "text": "..."}\n\n',
          `event: llm_usage\ndata: ${JSON.stringify({ calls: [call({ stage: "slots" })], usd_rub_rate: 80.5307, pricing })}\n\n`,
          'event: token\ndata: {"content": "Подобрал отели."}\n\n',
          `event: llm_usage\ndata: ${JSON.stringify({ calls: [call()], usd_rub_rate: 80.5307, pricing })}\n\n`,
          'event: done\ndata: {"status": "ok"}\n\n',
        ])
      )
    );
    window.history.pushState({}, "", "/catalog");

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.sendMessage("Отель в Сочи");
    });

    const [request] = getLlmUsageSnapshot();
    expect(request.message).toBe("Отель в Сочи");
    expect(request.page).toBe("/catalog");
    expect(request.calls.map((c) => c.stage)).toEqual(["slots", "response"]);
    expect(request.usdRubRate).toBe(80.5307);
    window.history.pushState({}, "", "/");
  });
});
