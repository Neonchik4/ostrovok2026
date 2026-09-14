export interface ThoughtItem {
  step: string;
  text: string;
}

/**
 * Чистый редуктор добавления или обновления шага хода мыслей.
 * Гарантирует иммутабельность состояния без побочных эффектов.
 */
export function updateThought(
  prev: readonly ThoughtItem[],
  step: string,
  text: string
): ThoughtItem[] {
  const existingStepIdx = prev.findIndex((t) => t.step === step);

  if (step === "reasoning") {
    const first = prev[0];
    if (first && first.step === "reasoning") {
      const isPlaceholder = first.text === "Анализирую параметры запроса...";
      return [
        { ...first, text: isPlaceholder ? text : first.text + text },
        ...prev.slice(1),
      ];
    }
    return [{ step, text }, ...prev];
  }

  if (existingStepIdx !== -1) {
    const updated = [...prev];
    updated[existingStepIdx] = { step, text };
    return updated;
  }

  return [...prev, { step, text }];
}

/**
 * Переводит последний активный шаг в статус 'cancelled' при остановке пользователем.
 */
export function markThoughtCancelled(prev: readonly ThoughtItem[]): ThoughtItem[] {
  if (prev.length === 0) return [...prev];
  const last = prev[prev.length - 1];

  if (
    last.step === "error" ||
    last.step === "cancelled" ||
    last.step === "stopped" ||
    last.text.includes("(остановлено)")
  ) {
    return [...prev];
  }

  return [
    ...prev.slice(0, -1),
    {
      step: "cancelled",
      text: `${last.text.replace(/\.\.\.$/, "").trim()} (остановлено пользователем)`,
    },
  ];
}

/**
 * Переводит последний активный шаг в статус 'error' при сетевом или серверном сбое.
 */
export function markThoughtError(
  prev: readonly ThoughtItem[],
  errorMessage: string
): ThoughtItem[] {
  const filtered = prev.filter((t) => t.text !== "Анализирую параметры запроса...");

  if (filtered.length > 0) {
    const last = filtered[filtered.length - 1];
    if (
      last.step !== "error" &&
      last.step !== "cancelled" &&
      last.step !== "stopped" &&
      !last.text.includes("(сбой)")
    ) {
      return [
        ...filtered.slice(0, -1),
        {
          ...last,
          step: "error",
          text: `${last.text.replace(/\.\.\.$/, "").trim()} (сбой)`,
        },
        { step: "error", text: `Ошибка: ${errorMessage}. Попробуйте повторить запрос.` },
      ];
    }
  }

  return [
    ...filtered,
    { step: "error", text: `Ошибка: ${errorMessage}. Попробуйте повторить запрос.` },
  ];
}
