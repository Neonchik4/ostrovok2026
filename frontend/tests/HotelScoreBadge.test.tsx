import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HotelScoreBadge, CriterionMatch } from "@/entities/hotel";

describe("HotelScoreBadge", () => {
  const mockBreakdown: CriterionMatch[] = [
    {
      criterion: "Бюджет",
      status: "code_verified",
      evidence: "8 500 ₽/ночь <= 10 000 ₽",
      is_positive: true,
    },
    {
      criterion: "Питомцы",
      status: "code_verified",
      evidence: "Размещение с животными разрешено",
      is_positive: true,
    },
    {
      criterion: "Атмосфера",
      status: "semantic_match",
      evidence: "Семантическое совпадение с отзывами гостей",
      is_positive: true,
    },
    {
      criterion: "Категория",
      status: "relaxed_compromise",
      evidence: "Категория 4★ вместо 5★",
      is_positive: false,
    },
  ];

  it("renders match score percentage correctly", () => {
    render(<HotelScoreBadge scorePct={96} />);
    expect(screen.getByText("96% совпадение")).toBeInTheDocument();
  });

  it("toggles criteria breakdown popover on click", () => {
    render(<HotelScoreBadge scorePct={94} criteriaBreakdown={mockBreakdown} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Contains breakdown sections
    expect(screen.getByText("Обоснование Match Score")).toBeInTheDocument();
    expect(screen.getByText("8 500 ₽/ночь <= 10 000 ₽")).toBeInTheDocument();
    expect(screen.getByText("Размещение с животными разрешено")).toBeInTheDocument();
    expect(screen.getByText("Семантическое совпадение с отзывами гостей")).toBeInTheDocument();
    expect(screen.getByText("Категория 4★ вместо 5★")).toBeInTheDocument();

    // Shows category tags
    expect(screen.getAllByText("Код").length).toBe(2);
    expect(screen.getByText("Вектор")).toBeInTheDocument();
    expect(screen.getByText("Компромисс")).toBeInTheDocument();

    // Click to close
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes popover on Escape key", () => {
    render(<HotelScoreBadge scorePct={94} criteriaBreakdown={mockBreakdown} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not toggle if criteriaBreakdown is empty", () => {
    render(<HotelScoreBadge scorePct={85} criteriaBreakdown={[]} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
