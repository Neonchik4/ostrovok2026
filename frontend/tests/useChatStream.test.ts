import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatStream } from "@/shared/api";

describe("useChatStream", () => {
  it("initializes with empty states", () => {
    const { result } = renderHook(() => useChatStream());

    expect(result.current.messages).toEqual([]);
    expect(result.current.thoughts).toEqual([]);
    expect(result.current.hotels).toEqual([]);
    expect(result.current.chips).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles stopStream safely without active stream", () => {
    const { result } = renderHook(() => useChatStream());

    act(() => {
      result.current.stopStream();
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it("adds user message on sendMessage call", async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: token\ndata: {"content": "Привет"}\n\n'
                ),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      })
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("Привет");
    });

    expect(result.current.messages.length).toBeGreaterThan(0);
    expect(result.current.messages[0].content).toBe("Привет");
  });

  it("sets user message content directly to disambiguation text without prefix", async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValueOnce({ done: true }),
          }),
        },
      })
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("", { disambiguation: "Только с завтраком" });
    });

    expect(result.current.messages.length).toBeGreaterThan(0);
    expect(result.current.messages[0].content).toBe("Только с завтраком");
  });

  it("accumulates multiple reasoning chunks into a single thought item", async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: thought\ndata: {"step": "reasoning", "text": "Анализирую "}\n\n' +
                  'event: thought\ndata: {"step": "reasoning", "text": "запрос пользователя."}\n\n' +
                  'event: thought\ndata: {"step": "filtering", "text": "Применяю фильтры"}\n\n'
                ),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      })
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage("Поиск отеля");
    });

    expect(result.current.thoughts.length).toBe(2);
    expect(result.current.thoughts[0]).toEqual({
      step: "reasoning",
      text: "Анализирую запрос пользователя.",
    });
    expect(result.current.thoughts[1]).toEqual({
      step: "filtering",
      text: "Применяю фильтры",
    });
  });
});

