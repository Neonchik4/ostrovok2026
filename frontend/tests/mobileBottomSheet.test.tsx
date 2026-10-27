import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  MobileBottomSheet,
  MobileFloatingBar,
} from "../src/features/mobile-bottom-sheet";

describe("Mobile Bottom Sheet & Floating Bar (Issue #37)", () => {
  it("renders mobile floating bar when hotels are found", () => {
    const handleOpen = vi.fn();
    render(
      <MobileFloatingBar
        hotelsCount={6}
        minPrice={4500}
        onOpen={handleOpen}
      />
    );

    const bar = screen.getByTestId("mobile-floating-bar");
    expect(bar).toBeDefined();
    expect(screen.getByText(/Найдено 6 вариантов от 4 500 ₽/i)).toBeDefined();

    fireEvent.click(bar.firstChild as Element);
    expect(handleOpen).toHaveBeenCalledTimes(1);
  });

  it("does not render mobile floating bar when hotelsCount is 0", () => {
    const { container } = render(
      <MobileFloatingBar
        hotelsCount={0}
        onOpen={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders mobile bottom sheet with drag handle and children when open", () => {
    const handleClose = vi.fn();
    render(
      <MobileBottomSheet
        isOpen={true}
        onClose={handleClose}
        title="Отели в Сочи"
        badgeText="12"
      >
        <div data-testid="test-content">Список отелей</div>
      </MobileBottomSheet>
    );

    const sheet = screen.getByTestId("mobile-bottom-sheet");
    expect(sheet).toBeDefined();
    expect(sheet.className).toContain("translate-y-0");
    expect(screen.getByText("Отели в Сочи")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByTestId("test-content")).toBeDefined();

    // Click backdrop
    const backdrop = screen.getByLabelText("Закрыть шторку");
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("hides mobile bottom sheet off-screen when isOpen is false", () => {
    render(
      <MobileBottomSheet
        isOpen={false}
        onClose={vi.fn()}
        title="Отели в Сочи"
      >
        <div>Контент</div>
      </MobileBottomSheet>
    );

    const sheet = screen.getByTestId("mobile-bottom-sheet");
    expect(sheet.className).toContain("translate-y-full");
  });

  it("closes on swipe down gesture", () => {
    const handleClose = vi.fn();
    render(
      <MobileBottomSheet
        isOpen={true}
        onClose={handleClose}
      >
        <div>Контент</div>
      </MobileBottomSheet>
    );

    const sheet = screen.getByTestId("mobile-bottom-sheet");
    fireEvent.touchStart(sheet, {
      touches: [{ clientY: 100 }],
    });
    fireEvent.touchEnd(sheet, {
      changedTouches: [{ clientY: 180 }],
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
