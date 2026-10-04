import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useChatStream } from "@/shared/api";

function emptyResponse() {
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("chat transport behind the reverse proxy", () => {
  it.each(["production", "development"])(
    "never retries on the visitor's localhost in %s",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.sendMessage("Отель в Москве");
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/chat/stream",
        expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) })
      );
      expect(result.current.error).toBe("Failed to fetch");
      expect(result.current.isStreaming).toBe(false);
    }
  );

  it("allows a new same-origin request after a network failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useChatStream());

    await act(async () => { await result.current.sendMessage("Москва"); });
    await act(async () => { await result.current.sendMessage("Сочи"); });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => url === "/api/chat/stream")).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("does not retry a proxy HTTP error against a different origin", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useChatStream());

    await act(async () => { await result.current.sendMessage("Москва"); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toContain("502");
  });
});
