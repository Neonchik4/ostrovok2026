import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "@/shared/ui";

describe("Logo (official Ostrovok brand asset)", () => {
  it("renders the square mark by default from the static asset", () => {
    render(<Logo />);
    const img = screen.getByAltText("Островок") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("/ostrovok-mark.png");
  });

  it("renders the wordmark variant from the official SVG", () => {
    render(<Logo variant="wordmark" />);
    const img = screen.getByAltText("Островок") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/ostrovok-logo.svg");
  });

  it("applies the requested size to the wrapper", () => {
    const { container } = render(<Logo size={40} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.height).toBe("40px");
  });
});
