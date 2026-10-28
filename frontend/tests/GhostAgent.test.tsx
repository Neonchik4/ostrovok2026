import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { GhostAgent, parseGhostIntent } from "@/features/ghost-agent";
import { emitScreenSwitch } from "@/shared/lib";

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

  it("parses star rating intents accurately", () => {
    const res5 = parseGhostIntent("отель 5 звезд люкс");
    expect(res5.handled).toBe(true);
    expect(res5.action?.type).toBe("set_stars");
    expect(res5.action?.value).toBe(5);

    const res4 = parseGhostIntent("гостиница от 4 звезд");
    expect(res4.handled).toBe(true);
    expect(res4.action?.type).toBe("set_stars");
    expect(res4.action?.value).toBe(4);
  });

  it("parses diverse amenity intents (breakfast, spa, pets, free cancellation)", () => {
    const resBreakfast = parseGhostIntent("с бесплатным завтраком");
    expect(resBreakfast.handled).toBe(true);
    expect(resBreakfast.action?.key).toBe("breakfast");

    const resSpa = parseGhostIntent("отель со спа и сауной");
    expect(resSpa.handled).toBe(true);
    expect(resSpa.action?.key).toBe("spa");

    const resPets = parseGhostIntent("можно с собакой");
    expect(resPets.handled).toBe(true);
    expect(resPets.action?.key).toBe("pets");

    const resCancel = parseGhostIntent("бесплатная отмена бронирования");
    expect(resCancel.handled).toBe(true);
    expect(resCancel.action?.key).toBe("freeCancellation");
  });

  it("parses top hotel selection intent accurately", () => {
    const res = parseGhostIntent("покажи лучший отель");
    expect(res.handled).toBe(true);
    expect(res.action?.type).toBe("select_hotel");
  });

  it("routes complex unhandled queries to AI streaming prompt", () => {
    const res = parseGhostIntent("романтический уикенд с видом на горы");
    expect(res.handled).toBe(false);
    expect(res.action?.type).toBe("prompt");
    expect(res.action?.text).toBe("романтический уикенд с видом на горы");
  });

  it("is closed by default: ghost in the corner with a hint bubble", () => {
    render(<GhostAgent />);

    expect(screen.getByRole("button", { name: "Открыть чат с Ghost" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Я могу помочь настроить фильтры.");
    expect(screen.queryByRole("region", { name: "Чат с Ghost" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ghost-action-bar")).not.toBeInTheDocument();
  });

  it("opens a compact chat: history, input, mic and send — as in the design", () => {
    render(<GhostAgent />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть чат с Ghost" }));

    const chat = screen.getByRole("region", { name: "Чат с Ghost" });
    expect(within(chat).getByRole("heading", { name: "Ghost" })).toBeInTheDocument();
    expect(within(chat).getByText("AI-агент каталога")).toBeInTheDocument();
    expect(within(chat).getByText("Помогу вам настроить поиск")).toBeInTheDocument();
    expect(within(chat).getByRole("textbox", { name: "Сообщение Ghost" })).toHaveAttribute(
      "placeholder",
      "Сообщение…"
    );
    expect(within(chat).getByRole("button", { name: "Голосовой ввод" })).toBeInTheDocument();
    expect(within(chat).getByRole("button", { name: "Отправить" })).toBeDisabled();

    // Подсказка и кнопка-призрак в углу на время чата скрыты
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Открыть чат с Ghost" })).not.toBeInTheDocument();
  });

  it("collapses the chat back to the corner ghost", () => {
    render(<GhostAgent />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть чат с Ghost" }));
    fireEvent.click(screen.getByRole("button", { name: "Скрыть чат" }));

    expect(screen.queryByRole("region", { name: "Чат с Ghost" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Открыть чат с Ghost" })).toBeInTheDocument();
  });

  it("applies filter intents from the chat and logs the dialog", () => {
    const handleAction = vi.fn();
    const handleSendPrompt = vi.fn();
    render(<GhostAgent onAction={handleAction} onSendPrompt={handleSendPrompt} />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть чат с Ghost" }));

    const input = screen.getByRole("textbox", { name: "Сообщение Ghost" });
    fireEvent.change(input, { target: { value: "с теплым бассейном" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(handleAction).toHaveBeenCalledWith({ type: "toggle_filter", key: "pool", value: true });
    expect(handleSendPrompt).not.toHaveBeenCalled();
    expect(input).toHaveValue("");

    const log = screen.getByRole("log", { name: "История диалога с Ghost" });
    expect(within(log).getByText("с теплым бассейном")).toBeInTheDocument();
    expect(within(log).getByText(/Теплый бассейн/)).toBeInTheDocument();
  });

  it("sends unrecognised requests to the AI stream", () => {
    const handleAction = vi.fn();
    const handleSendPrompt = vi.fn();
    render(<GhostAgent onAction={handleAction} onSendPrompt={handleSendPrompt} />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть чат с Ghost" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Сообщение Ghost" }), {
      target: { value: "романтический уикенд с видом на горы" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(handleSendPrompt).toHaveBeenCalledWith("романтический уикенд с видом на горы");
    expect(handleAction).not.toHaveBeenCalled();
  });

  it("shows streamed agent thoughts in the chat history", () => {
    const { rerender } = render(<GhostAgent isStreaming={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть чат с Ghost" }));

    rerender(<GhostAgent isStreaming currentThought="Ищу отели у моря" />);

    expect(
      within(screen.getByRole("log", { name: "История диалога с Ghost" })).getByText(
        "Ищу отели у моря"
      )
    ).toBeInTheDocument();
  });

  it("keeps the ghost on the chat header when the chat grows", () => {
    let notifyResize: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );

    render(<GhostAgent />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть чат с Ghost" }));
    const ghost = screen.getByTestId("ghost-flyer");
    const before = ghost.style.transform;

    // Новое сообщение: окно растёт вверх, шапка поднимается
    const panel = screen.getByRole("region", { name: "Чат с Ghost" });
    Object.defineProperty(panel, "offsetTop", { configurable: true, value: -120 });
    act(() => notifyResize());

    expect(ghost.style.transform).not.toBe(before);
    expect(ghost.style.transform).toContain("translate(");
    vi.unstubAllGlobals();
  });

  it("reports when the browser has no speech recognition", () => {
    render(<GhostAgent />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть чат с Ghost" }));
    fireEvent.click(screen.getByRole("button", { name: "Голосовой ввод" }));

    expect(
      screen.getByText("Голосовой ввод не поддерживается в этом браузере")
    ).toBeInTheDocument();
  });

  it("flies back to the header toggle when the user leaves the catalog", () => {
    render(<GhostAgent />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть чат с Ghost" }));

    act(() => {
      emitScreenSwitch({ to: "agent", duration: 560 });
    });

    expect(screen.queryByRole("region", { name: "Чат с Ghost" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Открыть чат с Ghost" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
