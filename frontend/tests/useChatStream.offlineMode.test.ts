import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useChatStream } from "@/shared/api";

const OFFLINE_MESSAGE = "Демо-режим (автономный эвристический агент без внешних API)";

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useChatStream offline mode handling (Issue #46)", () => {
  it("activates the offline notice on the SSE mode event", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          'event: thought\ndata: {"step": "reasoning", "text": "Оцениваю параметры запроса..."}\n\n',
          `event: mode\ndata: {"offline": true, "message": "${OFFLINE_MESSAGE}"}\n\n`,
          'event: token\ndata: {"content": "Подобрал отели."}\n\n',
          'event: widget\ndata: {"type": "hotel_grid", "hotels": [], "disambiguation_chips": []}\n\n',
          'event: done\ndata: {"status": "ok"}\n\n',
        ])
      )
    );

    const { result } = renderHook(() => useChatStream());
    expect(result.current.offlineMode).toBeNull();

    await act(async () => {
      await result.current.sendMessage("Отель в Сочи");
    });

    expect(result.current.offlineMode).toBe(OFFLINE_MESSAGE);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("keeps the offline notice null when the server sends no mode event", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          'event: thought\ndata: {"step": "reasoning", "text": "Оцениваю параметры запроса..."}\n\n',
          'event: token\ndata: {"content": "Подобрал отели."}\n\n',
          'event: done\ndata: {"status": "ok"}\n\n',
        ])
      )
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("Отель в Сочи");
    });

    expect(result.current.offlineMode).toBeNull();
  });
});
