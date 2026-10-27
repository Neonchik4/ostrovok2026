import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/widgets/AppHeader";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

describe("AppHeader (единая шапка экранов)", () => {
  it("renders the Ostrovok brand mark at 32px", () => {
    render(<AppHeader title="Агент Островка" />);
    const header = screen.getByRole("banner");
    const img = within(header).getByAltText("Островок") as HTMLImageElement;

    expect(img.getAttribute("src")).toBe("/ostrovok-mark.png");
    expect((img.parentElement as HTMLElement).style.height).toBe("32px");
  });

  it("renders the screen status title", () => {
    render(<AppHeader title="Каталог Островка" />);
    expect(
      within(screen.getByRole("banner")).getByRole("heading", { name: "Каталог Островка" })
    ).toBeInTheDocument();
  });

  it("has a fixed 56px height that does not shrink", () => {
    render(<AppHeader title="Агент Островка" />);
    const header = screen.getByRole("banner");

    expect(header).toHaveClass("h-14");
    expect(header).toHaveClass("shrink-0");
  });

  it("contains the technical Studio link", () => {
    render(<AppHeader title="Агент Островка" />);
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: /Studio/i })
    ).toHaveAttribute("href", "/studio");
  });

  it("contains the ghost screen switch with page labels", () => {
    render(<AppHeader title="Агент Островка" />);
    const header = screen.getByRole("banner");

    expect(within(header).getByRole("switch")).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "AI Консьерж" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Каталог Островка" })).toBeInTheDocument();
  });
});
