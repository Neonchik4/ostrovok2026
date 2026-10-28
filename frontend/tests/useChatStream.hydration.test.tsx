import { act, cleanup } from "@testing-library/react";
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatStream } from "@/shared/api";

const cachedHotels = [{ id: "hotel-1" }, { id: "hotel-2" }, { id: "hotel-3" }];

function HotelsCount() {
  const { hotels, isCacheRestored } = useChatStream();
  return (
    <p>
      <b>{hotels.length} отелей</b>
      <span data-testid="restored">{String(isCacheRestored)}</span>
    </p>
  );
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("useChatStream sessionStorage cache and SSR hydration", () => {
  it("renders the server markup first and restores cached hotels after hydration", async () => {
    // Сервер не видит sessionStorage — рендерим разметку без кэша.
    const serverHtml = renderToString(<HotelsCount />);
    sessionStorage.setItem("ostrovok_cached_hotels", JSON.stringify(cachedHotels));

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, <HotelsCount />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector("b")?.textContent).toBe("3 отелей");
    expect(container.querySelector("[data-testid=restored]")?.textContent).toBe("true");
    container.remove();
  });
});
