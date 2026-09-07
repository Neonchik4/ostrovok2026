import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickChips } from "@/features/quick-chips";

describe("QuickChips component", () => {
  it("renders null when chips array is empty", () => {
    const { container } = render(
      <QuickChips chips={[]} onSelectChip={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders chips with labels", () => {
    const chips = ["С завтраком", "С бассейном", "До 10 000 ₽ / ночь"];
    render(<QuickChips chips={chips} onSelectChip={vi.fn()} />);

    expect(screen.getByText("Уточнить поиск:")).toBeInTheDocument();
    expect(screen.getByText("С завтраком")).toBeInTheDocument();
    expect(screen.getByText("С бассейном")).toBeInTheDocument();
    expect(screen.getByText("До 10 000 ₽ / ночь")).toBeInTheDocument();
  });

  it("disables chips when disabled prop is true", () => {
    const chips = ["Свободная отмена"];
    render(<QuickChips chips={chips} onSelectChip={vi.fn()} disabled={true} />);

    const button = screen.getByRole("button", { name: /Свободная отмена/i });
    expect(button).toBeDisabled();
  });
});
