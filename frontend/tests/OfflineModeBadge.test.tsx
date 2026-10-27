import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { OfflineModeBadge } from "@/features/offline-mode";

describe("OfflineModeBadge (Issue #46)", () => {
  it("renders nothing when the offline message is absent", () => {
    const { container } = render(<OfflineModeBadge message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the autonomous mode notice from the SSE mode event", () => {
    render(
      <OfflineModeBadge message="Демо-режим (автономный эвристический агент без внешних API)" />
    );

    const badge = screen.getByTestId("offline-mode-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("Демо-режим (автономный эвристический агент без внешних API)");
  });

  it("keeps the full notice available in the title attribute", () => {
    render(<OfflineModeBadge message="Демо-режим (автономный эвристический агент)" />);
    const badge = screen.getByTestId("offline-mode-badge");
    expect(badge.getAttribute("title")).toBe("Демо-режим (автономный эвристический агент)");
  });
});
