import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  parseGhostIntent,
  ThoughtLog,
  ActionBar,
  GhostAgent,
  ThoughtStep,
} from "@/features/ghost-agent";

describe("Ghost Agent & Intent Router (Frontend 2)", () => {
  it("parses price filter intent accurately", () => {
    const res = parseGhostIntent("отели дешевле 10 000 руб");
    expect(res.handled).toBe(true);
    expect(res.action?.type).toBe("set_price");
    expect(res.action?.value).toBe(10000);
    expect(res.thoughts.length).toBeGreaterThanOrEqual(2);
    expect(res.thoughts[0].tag).toBe("intent");
  });

  it("parses pool amenity intent accurately", () => {
    const res = parseGhostIntent("покажи с теплым бассейном");
    expect(res.handled).toBe(true);
    expect(res.action?.type).toBe("toggle_filter");
    expect(res.action?.key).toBe("pool");
    expect(res.speechText).toContain("Теплый бассейн");
  });

  it("parses reset filters intent accurately", () => {
    const res = parseGhostIntent("сбрось все фильтры");
    expect(res.handled).toBe(true);
    expect(res.action?.type).toBe("reset");
  });

  it("renders ThoughtLog with structured steps and tag badges", () => {
    const steps: ThoughtStep[] = [
      { id: "1", tag: "intent", text: "Распознан интент: бассейн", timestamp: 100 },
      { id: "2", tag: "action", text: "Активирую фильтр в интерфейсе", timestamp: 150 },
    ];
    const handleClose = vi.fn();

    render(<ThoughtLog steps={steps} isOpen={true} onClose={handleClose} />);

    expect(screen.getByText("Ход мыслей агента (SSE Stream)")).toBeInTheDocument();
    expect(screen.getByText("[ИНТЕНТ]")).toBeInTheDocument();
    expect(screen.getByText("[ДЕЙСТВИЕ]")).toBeInTheDocument();
    expect(screen.getByText("Распознан интент: бассейн")).toBeInTheDocument();

    const closeBtn = screen.getByLabelText("Скрыть панель мыслей");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders ActionBar with chips, text input and voice button", () => {
    const handleSelectChip = vi.fn();
    const handleSubmitPrompt = vi.fn();
    const handleToggleVoice = vi.fn();

    render(
      <ActionBar
        chips={["Теплый бассейн", "С завтраком"]}
        onSelectChip={handleSelectChip}
        onSubmitPrompt={handleSubmitPrompt}
        isListening={false}
        onToggleVoice={handleToggleVoice}
      />
    );

    expect(screen.getByTestId("ghost-action-bar")).toBeInTheDocument();
    expect(screen.getByText("AI Консьерж")).toBeInTheDocument();

    // Chip click
    const poolChip = screen.getByRole("button", { name: "Теплый бассейн" });
    fireEvent.click(poolChip);
    expect(handleSelectChip).toHaveBeenCalledWith("Теплый бассейн");

    // Input submit
    const input = screen.getByPlaceholderText("Спросите или настройте...");
    fireEvent.change(input, { target: { value: "Сочи 5 звезд" } });
    fireEvent.click(screen.getByLabelText("Отправить запрос"));
    expect(handleSubmitPrompt).toHaveBeenCalledWith("Сочи 5 звезд");

    // Voice button
    const voiceBtn = screen.getByLabelText("Включить голосовой ввод");
    fireEvent.click(voiceBtn);
    expect(handleToggleVoice).toHaveBeenCalledTimes(1);
  });

  it("renders GhostAgent declaratively in JSX and handles action callbacks", () => {
    const handleAction = vi.fn();
    render(<GhostAgent onAction={handleAction} />);

    expect(screen.getByTestId("ghost-actor-container")).toBeInTheDocument();
    expect(screen.getByTestId("ghost-action-bar")).toBeInTheDocument();

    // Click on chip
    const chip = screen.getByRole("button", { name: "Теплый бассейн" });
    fireEvent.click(chip);

    expect(handleAction).toHaveBeenCalledWith({
      type: "toggle_filter",
      key: "pool",
      value: true,
    });
  });
});
