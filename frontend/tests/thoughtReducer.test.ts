import { describe, it, expect } from "vitest";
import {
  updateThought,
  markThoughtCancelled,
  markThoughtError,
  ThoughtItem,
} from "@/shared/api";

describe("thoughtReducer (Pure Functions & State Immutability)", () => {
  it("replaces the reasoning placeholder on initial thought token", () => {
    const initial: ThoughtItem[] = [
      { step: "reasoning", text: "Анализирую параметры запроса..." },
    ];
    const updated = updateThought(initial, "reasoning", "Ищу отели в Сочи");

    expect(updated.length).toBe(1);
    expect(updated[0].text).toBe("Ищу отели в Сочи");
    // Проверка иммутабельности исходного массива
    expect(initial[0].text).toBe("Анализирую параметры запроса...");
  });

  it("appends to existing reasoning token stream", () => {
    const initial: ThoughtItem[] = [
      { step: "reasoning", text: "Ищу отели" },
    ];
    const updated = updateThought(initial, "reasoning", " в Красной Поляне");

    expect(updated.length).toBe(1);
    expect(updated[0].text).toBe("Ищу отели в Красной Поляне");
  });

  it("updates an existing discrete step", () => {
    const initial: ThoughtItem[] = [
      { step: "reasoning", text: "Анализ..." },
      { step: "search", text: "Векторный поиск..." },
    ];
    const updated = updateThought(initial, "search", "Найдено 15 отелей");

    expect(updated.length).toBe(2);
    expect(updated[1].text).toBe("Найдено 15 отелей");
  });

  it("adds a new step if not present", () => {
    const initial: ThoughtItem[] = [
      { step: "reasoning", text: "Анализ..." },
    ];
    const updated = updateThought(initial, "pricing", "Проверка чеков");

    expect(updated.length).toBe(2);
    expect(updated[1]).toEqual({ step: "pricing", text: "Проверка чеков" });
  });

  it("marks in-progress thought as cancelled when stopped", () => {
    const initial: ThoughtItem[] = [
      { step: "search", text: "Ищу варианты..." },
    ];
    const updated = markThoughtCancelled(initial);

    expect(updated.length).toBe(1);
    expect(updated[0].step).toBe("cancelled");
    expect(updated[0].text).toContain("(остановлено пользователем)");
  });

  it("marks in-progress thought as error on failure", () => {
    const initial: ThoughtItem[] = [
      { step: "search", text: "Подбор..." },
    ];
    const updated = markThoughtError(initial, "Connection timeout");

    expect(updated.length).toBe(2);
    expect(updated[0].step).toBe("error");
    expect(updated[0].text).toContain("(сбой)");
    expect(updated[1].step).toBe("error");
    expect(updated[1].text).toContain("Connection timeout");
  });
});
