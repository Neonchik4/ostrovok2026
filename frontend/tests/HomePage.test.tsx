import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/api")>()),
  useChatStream: () => ({
    messages: [],
    thoughts: [],
    hotels: [],
    chips: [],
    transportSummary: null,
    isStreaming: false,
    isThinking: false,
    sendMessage: vi.fn(),
    stopStream: vi.fn(),
    restoreSharedTrip: vi.fn(),
  }),
}));

describe("HomePage unified header", () => {
  it("renders AppHeader at the top of the page with the brand mark and 56px height", () => {
    const { container } = render(<HomePage />);
    const header = screen.getByRole("heading", { name: "Агент Островка" }).closest("header");

    expect(header).not.toBeNull();
    if (!header) return;
    // Шапка — первый элемент корня страницы, в потоке документа (как на /catalog)
    expect((container.firstChild as HTMLElement).firstElementChild).toBe(header);
    expect(header).toHaveClass("h-14");
    expect(within(header).getByAltText("Островок")).toHaveAttribute("src", "/ostrovok-mark.png");
    expect(within(header).getByRole("heading", { name: "Агент Островка" })).toBeInTheDocument();
  });

  it("renders the single screen switch inside the header (no floating fixed switcher)", () => {
    render(<HomePage />);
    const header = screen.getByRole("heading", { name: "Агент Островка" }).closest("header");
    const navs = screen.getAllByRole("navigation", { name: "Переключатель экранов" });

    expect(navs).toHaveLength(1);
    expect(header).toContainElement(navs[0]);
    expect(within(navs[0]).getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("does not duplicate the brand title or Studio link inside the chat column", () => {
    render(<HomePage />);
    expect(screen.getAllByText("Агент Островка")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: /Studio/i })).toHaveLength(1);
  });
});
