import { act, cleanup } from "@testing-library/react";
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatStream } from "@/shared/api";

const cachedHotel = { id: "cached-1", name: "Отель из кэша", city: "Сочи" };

function HotelsProbe() {
  const { hotels, isRestoringCache } = useChatStream();
  return (
    <div data-restoring={String(isRestoringCache)}>
      {hotels.map((h) => (
        <span key={h.id}>{h.name}</span>
      ))}
    </div>
  );
}

describe("useChatStream — кэш отелей и SSR-гидрация", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the same markup as the server and restores the cache after mount", async () => {
    // Сервер не видит sessionStorage — рендерим «серверный» HTML до появления кэша
    const serverHtml = renderToString(<HotelsProbe />);
    sessionStorage.setItem("ostrovok_cached_hotels", JSON.stringify([cachedHotel]));

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, <HotelsProbe />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent("Отель из кэша");
    expect(container.firstElementChild).toHaveAttribute("data-restoring", "false");
    container.remove();
  });
});
