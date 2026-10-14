import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThoughtStream } from "@/entities/thought";

describe("ThoughtStream component", () => {
  it("renders null when thoughts array is empty", () => {
    const { container } = render(
      <ThoughtStream thoughts={[]} isStreaming={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders thoughts with clean text without emoji in count, collapsed by default and expandable", () => {
    const thoughts = [
      { step: "reasoning", text: "Оцениваю параметры поездки в Красную Поляну" },
      { step: "filtering", text: "Применяю фильтр: теплый бассейн" },
      { step: "results", text: "Найдено 4 отеля" },
    ];

    render(<ThoughtStream thoughts={thoughts} isStreaming={false} />);

    // Заголовок и счетчик шагов видны сразу
    expect(screen.getByText("Ход рассуждений агента")).toBeInTheDocument();
    expect(screen.getByText("3 шагов")).toBeInTheDocument();
    expect(screen.queryByText(/✅/)).toBeNull();

    // По умолчанию свернуто — шагов нет на экране (нет перегрузки чата)
    expect(screen.queryByText("Оцениваю параметры поездки в Красную Поляну")).toBeNull();

    // Разворачиваем кликом
    const toggleButton = screen.getByRole("button", { name: /Ход рассуждений агента/i });
    fireEvent.click(toggleButton);

    // Проверяем текст мыслей после раскрытия
    expect(screen.getByText("Оцениваю параметры поездки в Красную Поляну")).toBeInTheDocument();
    expect(screen.getByText("Применяю фильтр: теплый бассейн")).toBeInTheDocument();
    expect(screen.getByText("Найдено 4 отеля")).toBeInTheDocument();
  });

  it("does not apply line-through decoration to finished thoughts", () => {
    const thoughts = [
      { step: "reasoning", text: "Анализирую запрошенные даты" },
      { step: "results", text: "Готово" },
    ];

    render(<ThoughtStream thoughts={thoughts} isStreaming={false} defaultCollapsed={false} />);

    const itemText = screen.getByText("Анализирую запрошенные даты");
    expect(itemText.className).not.toContain("line-through");
  });

  it("is collapsed by default and expands/collapses when header is clicked", () => {
    const thoughts = [
      { step: "reasoning", text: "Тестовое рассуждение" },
    ];

    render(<ThoughtStream thoughts={thoughts} isStreaming={false} />);

    const toggleButton = screen.getByRole("button", { name: /Ход рассуждений агента/i });
    
    // Свернуто по умолчанию
    expect(screen.queryByText("Тестовое рассуждение")).toBeNull();

    // Разворачиваем кликом
    fireEvent.click(toggleButton);
    expect(screen.getByText("Тестовое рассуждение")).toBeInTheDocument();

    // Сворачиваем обратно
    fireEvent.click(toggleButton);
    expect(screen.queryByText("Тестовое рассуждение")).toBeNull();
  });

  it("shows live step progress in header ticker when isThinking is true", () => {
    const thoughts = [
      { step: "reasoning", text: "Анализирую параметры..." },
      { step: "filtering", text: "Применяю фильтры..." },
    ];

    render(<ThoughtStream thoughts={thoughts} isStreaming={true} isThinking={true} />);

    expect(screen.getByText("Шаг 2 из 5")).toBeInTheDocument();
    // Актуальное действие отображается в компактном бегущем превью
    expect(screen.getByText("Применяю фильтры...")).toBeInTheDocument();
  });

  it("renders red error styling and failure badge when a thought step is an error", () => {
    const thoughts = [
      { step: "reasoning", text: "Оцениваю параметры поездки" },
      { step: "search", text: "Ищу отели в Красной Поляне..." },
      { step: "error", text: "Ошибка: Failed to fetch. Попробуйте повторить запрос." },
    ];

    const { container } = render(
      <ThoughtStream thoughts={thoughts} isStreaming={false} defaultCollapsed={false} />
    );

    expect(screen.getByText("Сбой")).toBeInTheDocument();
    const errorText = screen.getByText("Ошибка: Failed to fetch. Попробуйте повторить запрос.");
    expect(errorText).toBeInTheDocument();
    expect(errorText.className).toContain("text-destructive");

    // Незавершённый шаг поиска перед ошибкой также должен быть помечен сбоем, а не зелёной галочкой
    const searchText = screen.getByText("Ищу отели в Красной Поляне...");
    expect(searchText.className).toContain("text-destructive");

    // В DOM должна быть только одна галочка (для первого успешно завершённого шага reasoning)
    const checkmarks = container.querySelectorAll(".text-success");
    expect(checkmarks.length).toBe(1);

    // И два красных крестика (для прерванного поиска и для самой ошибки)
    const errorCrosses = container.querySelectorAll(".text-destructive");
    expect(errorCrosses.length).toBeGreaterThanOrEqual(2);
  });

  it("renders red cross and stopped badge without green checkmark when stream is cancelled by user", () => {
    const thoughts = [
      { step: "reasoning", text: "Оцениваю параметры запроса" },
      { step: "cancelled", text: "Ищу подходящие варианты (остановлено пользователем)" },
    ];

    const { container } = render(
      <ThoughtStream thoughts={thoughts} isStreaming={false} defaultCollapsed={false} />
    );

    // В шапке должен быть бейдж остановки
    expect(screen.getByText("Остановлено")).toBeInTheDocument();

    // Остановленный шаг обязан иметь цвет ошибки/отмены
    const stoppedText = screen.getByText("Ищу подходящие варианты (остановлено пользователем)");
    expect(stoppedText.className).toContain("text-destructive");

    // Только один первый шаг получил галочку, остановленный шаг НЕ должен получать галочку
    const checkmarks = container.querySelectorAll(".text-success");
    expect(checkmarks.length).toBe(1);
  });

  it("renders red cross on single step if cancelled immediately", () => {
    const thoughts = [
      { step: "cancelled", text: "Анализирую параметры запроса (остановлено пользователем)" },
    ];

    const { container } = render(
      <ThoughtStream thoughts={thoughts} isStreaming={false} defaultCollapsed={false} />
    );

    expect(screen.getByText("Остановлено")).toBeInTheDocument();
    const checkmarks = container.querySelectorAll(".text-success");
    expect(checkmarks.length).toBe(0);
  });

  it("handles long detailed thoughts by clamping elaboration without exploding the screen", () => {
    const thoughts = [
      {
        step: "reasoning",
        text: "Оцениваю параметры запроса и формирую критерии поиска... Оцениваю запрос пользователя на поездку в Красную Поляну: едут вдвоем, берут с собой собаку и обязательно хотят отель с теплым бассейном. Учитывая горную специфику курорта, мне нужно сразу отсечь варианты, где действуют строгие ограничения на размещение с животным.",
      },
    ];

    render(<ThoughtStream thoughts={thoughts} isStreaming={false} defaultCollapsed={false} />);

    // Заголовок шага выделен аккуратно
    expect(
      screen.getByText("Оцениваю параметры запроса и формирую критерии поиска...")
    ).toBeInTheDocument();
    // Длинное пояснение аккуратно скомпоновано с line-clamp
    const detailEl = screen.getByText(/Оцениваю запрос пользователя на поездку в Красную Поляну/i);
    expect(detailEl).toBeInTheDocument();
    expect(detailEl.className).toContain("line-clamp-2");
  });
});
