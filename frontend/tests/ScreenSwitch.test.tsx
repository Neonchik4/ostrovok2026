import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScreenSwitch } from "@/features/screen-switch";
import { GHOST_TOGGLE_DURATION } from "@/shared/ui";

const push = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, prefetch: vi.fn() }),
}));

describe("ScreenSwitch (переключатель AI Консьерж <-> Каталог Островка)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockClear();
    pathname = "/";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is off on / and on on /catalog", () => {
    const { unmount } = render(<ScreenSwitch />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    unmount();

    pathname = "/catalog";
    render(<ScreenSwitch />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("renders page labels on both sides of the toggle", () => {
    render(<ScreenSwitch />);
    const left = screen.getByRole("button", { name: "AI Консьерж" });
    const toggle = screen.getByRole("switch");
    const right = screen.getByRole("button", { name: "Каталог Островка" });

    expect(left.nextElementSibling).toBe(toggle);
    expect(toggle.nextElementSibling).toBe(right);
    expect(left).toHaveAttribute("aria-current", "page");
    expect(right).not.toHaveAttribute("aria-current");
  });

  it("navigates only after the ghost flight finishes", () => {
    render(<ScreenSwitch />);
    fireEvent.click(screen.getByRole("switch"));

    // Призрак сразу летит вправо, а роут меняется после перелёта
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(push).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(GHOST_TOGGLE_DURATION);
    });
    expect(push).toHaveBeenCalledWith("/catalog");
  });

  it("switches back to / from /catalog", () => {
    pathname = "/catalog";
    render(<ScreenSwitch />);
    fireEvent.click(screen.getByRole("switch"));
    act(() => {
      vi.advanceTimersByTime(GHOST_TOGGLE_DURATION);
    });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("clicking the inactive label switches the screen", () => {
    render(<ScreenSwitch />);
    fireEvent.click(screen.getByRole("button", { name: "Каталог Островка" }));
    act(() => {
      vi.advanceTimersByTime(GHOST_TOGGLE_DURATION);
    });
    expect(push).toHaveBeenCalledWith("/catalog");
  });

  it("clicking the active label does nothing", () => {
    render(<ScreenSwitch />);
    fireEvent.click(screen.getByRole("button", { name: "AI Консьерж" }));
    act(() => {
      vi.advanceTimersByTime(GHOST_TOGGLE_DURATION);
    });
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores repeated clicks during the flight", () => {
    render(<ScreenSwitch />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    act(() => {
      vi.advanceTimersByTime(GHOST_TOGGLE_DURATION);
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/catalog");
  });

  it("cancels pending navigation on unmount", () => {
    const { unmount } = render(<ScreenSwitch />);
    fireEvent.click(screen.getByRole("switch"));
    unmount();
    act(() => {
      vi.advanceTimersByTime(GHOST_TOGGLE_DURATION);
    });
    expect(push).not.toHaveBeenCalled();
  });
});
