import { fireEvent,render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ONBOARDING_SCENARIOS,
  OnboardingScenarioChips,
} from "@/features/onboarding-scenarios";
import { ChatConcierge } from "@/widgets/ChatConcierge";

describe("OnboardingScenarioChips component", () => {
  it("renders all five onboarding scenarios with labels and hints", () => {
    render(<OnboardingScenarioChips onSelectScenario={vi.fn()} />);

    expect(screen.getByTestId("onboarding-scenarios")).toBeInTheDocument();
    for (const scenario of ONBOARDING_SCENARIOS) {
      expect(screen.getByText(scenario.label)).toBeInTheDocument();
      expect(screen.getByText(scenario.hint)).toBeInTheDocument();
    }
  });

  it("sends the formulated scenario query on click", () => {
    const onSelectScenario = vi.fn();
    render(<OnboardingScenarioChips onSelectScenario={onSelectScenario} />);

    fireEvent.click(screen.getByRole("button", { name: /К морю/i }));

    expect(onSelectScenario).toHaveBeenCalledTimes(1);
    expect(onSelectScenario).toHaveBeenCalledWith(ONBOARDING_SCENARIOS[0].query);
  });

  it("disables every scenario button while streaming", () => {
    render(<OnboardingScenarioChips onSelectScenario={vi.fn()} disabled={true} />);

    for (const scenario of ONBOARDING_SCENARIOS) {
      expect(
        screen.getByRole("button", { name: new RegExp(scenario.label, "i") })
      ).toBeDisabled();
    }
  });
});

describe("Onboarding scenarios visibility in ChatConcierge", () => {
  it("shows scenario chips in the empty chat before the first message", () => {
    render(
      <ChatConcierge
        messages={[]}
        thoughts={[]}
        chips={[]}
        isStreaming={false}
        onSendMessage={vi.fn()}
        onStopStream={vi.fn()}
      />
    );

    expect(screen.getByTestId("onboarding-scenarios")).toBeInTheDocument();
  });

  it("hides scenario chips after the first message is sent", () => {
    render(
      <ChatConcierge
        messages={[
          {
            id: "user-1",
            role: "user",
            content: "Хочу на море в Сочи",
            timestamp: "12:00",
          },
        ]}
        thoughts={[]}
        chips={[]}
        isStreaming={false}
        onSendMessage={vi.fn()}
        onStopStream={vi.fn()}
      />
    );

    expect(screen.queryByTestId("onboarding-scenarios")).not.toBeInTheDocument();
  });

  it("starts the agent search flow with the scenario query on chip click", () => {
    const onSendMessage = vi.fn();
    render(
      <ChatConcierge
        messages={[]}
        thoughts={[]}
        chips={[]}
        isStreaming={false}
        onSendMessage={onSendMessage}
        onStopStream={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /В культурную столицу/i }));

    expect(onSendMessage).toHaveBeenCalledTimes(1);
    const [query] = onSendMessage.mock.calls[0];
    expect(typeof query).toBe("string");
    expect(query.length).toBeGreaterThan(0);
    expect(query).toContain("Санкт-Петербург");
  });
});
