import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShareTripButton } from "@/features/share-trip";

describe("ShareTripButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the copied message inside the button for 1 second, then restores the label", async () => {
    render(<ShareTripButton url="https://example.test/trip" label="Поделиться" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Поделиться/ }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://example.test/trip");
    expect(screen.getByRole("button")).toHaveTextContent("Ссылка скопирована в буфер обмена");
    // Без отдельного всплывающего окна — оно обрезалось шапкой сайта
    expect(document.querySelector(".fixed")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Ссылка скопирована в буфер обмена");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Поделиться");
    expect(screen.getByRole("button")).not.toHaveTextContent("скопирована");
  });
});
