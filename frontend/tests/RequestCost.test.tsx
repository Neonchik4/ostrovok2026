import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestCostButton } from "@/features/request-cost";
import { appendLlmUsage, clearLlmUsage, LlmCallUsage } from "@/shared/api";
import { AppHeader } from "@/widgets/AppHeader";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

const pricing = { source: "https://ai.google.dev/gemini-api/docs/pricing", updated: "2026-10-27" };

const call = (overrides: Partial<LlmCallUsage>): LlmCallUsage => ({
  stage: "response",
  model: "gemini-3.5-flash-lite",
  input_tokens: 0,
  cached_tokens: 0,
  output_tokens: 0,
  thinking_tokens: 0,
  total_tokens: 0,
  ttft_ms: null,
  duration_ms: 0,
  output_tokens_per_sec: null,
  streamed: false,
  gateway_cache_hit: false,
  cost_usd: 0,
  ...overrides,
});

function seedSession() {
  // Главная: разбор запроса + стриминговый ответ
  appendLlmUsage(
    { id: "req-1", message: "Сочи у моря", page: "/", startedAt: "2026-10-28T10:00:00.000Z" },
    {
      calls: [
        call({ stage: "slots", input_tokens: 1000, output_tokens: 50, total_tokens: 1050, duration_ms: 900, cost_usd: 0.0004 }),
        call({
          stage: "response",
          input_tokens: 2000,
          output_tokens: 200,
          total_tokens: 2200,
          ttft_ms: 400,
          duration_ms: 2000,
          output_tokens_per_sec: 125.5,
          streamed: true,
          cost_usd: 0.0011,
        }),
      ],
      usd_rub_rate: 80,
      pricing,
    }
  );
  // Каталог: Ghost-агент, последний запрос
  appendLlmUsage(
    { id: "req-2", message: "Дешевле 10 000 ₽", page: "/catalog", startedAt: "2026-10-28T10:05:00.000Z" },
    {
      calls: [
        call({
          stage: "response",
          model: "gemini-3.6-flash",
          input_tokens: 500,
          output_tokens: 100,
          total_tokens: 600,
          ttft_ms: 1300,
          duration_ms: 2300,
          output_tokens_per_sec: 100,
          streamed: true,
          cost_usd: 0.0005,
        }),
      ],
      usd_rub_rate: 80,
      pricing,
    }
  );
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Request Cost" }));
  return screen.getByRole("dialog", { name: "Стоимость запросов к LLM" });
}

beforeEach(() => {
  sessionStorage.clear();
  clearLlmUsage();
});

describe("Request Cost", () => {
  it("sits in the site header next to Studio", () => {
    render(<AppHeader title="Агент Островка" />);
    const header = screen.getByRole("banner");
    const studio = within(header).getByRole("link", { name: /Studio/i });
    const requestCost = within(header).getByRole("button", { name: "Request Cost" });

    expect(studio.nextElementSibling).toBe(requestCost);
  });

  it("shows an empty state before any LLM request", () => {
    render(<RequestCostButton />);
    const dialog = openDialog();

    expect(within(dialog).getByText(/Запросов к LLM в этой вкладке пока не было/)).toBeInTheDocument();
  });

  it("shows cost, tokens, TTFT and speed of the latest request", () => {
    seedSession();
    render(<RequestCostButton />);
    const latest = within(openDialog()).getByRole("region", { name: "Последний запрос" });

    expect(latest).toHaveTextContent("Дешевле 10 000 ₽");
    expect(within(latest).getByTestId("metric-cost")).toHaveTextContent(/0,0005\s\$/);
    expect(within(latest).getByTestId("metric-cost")).toHaveTextContent(/0,04\s₽/);
    expect(within(latest).getByTestId("metric-tokens")).toHaveTextContent("600");
    expect(within(latest).getByTestId("metric-ttft")).toHaveTextContent(/1,3\sс/);
    expect(within(latest).getByTestId("metric-speed")).toHaveTextContent(/100\sток\/с/);
  });

  it("lists every LLM API call of each request with its own metrics", () => {
    seedSession();
    render(<RequestCostButton />);
    const history = within(openDialog()).getByRole("region", { name: "Все запросы сессии" });
    const first = within(history).getByRole("table", { name: /Сочи у моря/ });
    const rows = within(first).getAllByRole("row").slice(1);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Разбор запроса");
    expect(rows[0]).toHaveTextContent(/1\s050/);
    expect(rows[1]).toHaveTextContent("Ответ агента");
    expect(rows[1]).toHaveTextContent(/400\sмс/);
    expect(rows[1]).toHaveTextContent(/125,5\sток\/с/);
    expect(rows[1]).toHaveTextContent(/0,0011\s\$/);
    expect(within(history).getByRole("table", { name: /Каталог/ })).toBeInTheDocument();
  });

  it("sums the whole tab session across the chat and the catalog", () => {
    seedSession();
    render(<RequestCostButton />);
    const total = within(openDialog()).getByRole("region", { name: "Итого за сессию" });

    expect(within(total).getByTestId("total-requests")).toHaveTextContent("2");
    expect(within(total).getByTestId("total-calls")).toHaveTextContent("3");
    expect(within(total).getByTestId("total-tokens")).toHaveTextContent(/3\s850/);
    expect(within(total).getByTestId("total-cost")).toHaveTextContent(/0,002\s\$/);
    expect(within(total).getByTestId("total-cost")).toHaveTextContent(/0,16\s₽/);
    expect(total).toHaveTextContent(/80\s₽ за \$1/);
  });

  it("marks calls answered from the AI Gateway cache as free", () => {
    appendLlmUsage(
      { id: "req-3", message: "Повтор", page: "/", startedAt: "2026-10-28T10:10:00.000Z" },
      {
        calls: [call({ stage: "slots", total_tokens: 900, gateway_cache_hit: true, cost_usd: 0 })],
        usd_rub_rate: 80,
        pricing,
      }
    );
    render(<RequestCostButton />);
    const history = within(openDialog()).getByRole("region", { name: "Все запросы сессии" });

    expect(within(history).getAllByRole("row")[1]).toHaveTextContent(/кэш шлюза/);
  });

  it("never invents numbers: unknown tokens, price or rate are reported as not received", () => {
    seedSession();
    appendLlmUsage(
      { id: "req-4", message: "Оборванный ответ", page: "/catalog", startedAt: "2026-10-28T10:20:00.000Z" },
      {
        calls: [
          call({
            stage: "response",
            input_tokens: null,
            cached_tokens: null,
            output_tokens: null,
            thinking_tokens: null,
            total_tokens: null,
            ttft_ms: 350,
            streamed: true,
            cost_usd: null,
          }),
        ],
        usd_rub_rate: null,
        pricing: null,
      }
    );
    render(<RequestCostButton />);
    const dialog = openDialog();

    const latest = within(dialog).getByRole("region", { name: "Последний запрос" });
    expect(within(latest).getByTestId("metric-cost")).toHaveTextContent("Не удалось получить");
    expect(within(latest).getByTestId("metric-tokens")).toHaveTextContent("Не удалось получить");
    expect(within(latest).getByTestId("metric-speed")).toHaveTextContent("Не удалось получить");

    const row = within(within(dialog).getByRole("table", { name: /Оборванный ответ/ })).getAllByRole("row")[1];
    expect(row).toHaveTextContent(/не удалось получить/);
    expect(row).not.toHaveTextContent(/\$/);

    // Итог — только по известным вызовам и с явной оговоркой
    const total = within(dialog).getByRole("region", { name: "Итого за сессию" });
    expect(within(total).getByTestId("total-cost")).toHaveTextContent(/не менее 0,002\s\$/);
    expect(within(total).getByTestId("total-cost")).toHaveTextContent(/по 1 вызову данные не получены/);
    expect(within(total).getByTestId("total-tokens")).toHaveTextContent(/не менее 3\s850/);
  });

  it("does not show rubles when the server has no USD_RUB_RATE", () => {
    appendLlmUsage(
      { id: "req-5", message: "Без курса", page: "/", startedAt: "2026-10-28T10:30:00.000Z" },
      { calls: [call({ total_tokens: 100, cost_usd: 0.001 })], usd_rub_rate: null, pricing }
    );
    render(<RequestCostButton />);
    const total = within(openDialog()).getByRole("region", { name: "Итого за сессию" });

    expect(within(total).getByTestId("total-cost")).toHaveTextContent(/0,001\s\$/);
    expect(within(total).getByTestId("total-cost")).not.toHaveTextContent("₽");
    expect(total).toHaveTextContent(/Курс USD → RUB на сервере не задан/);
  });

  it("marks non-streaming calls instead of inventing a TTFT", () => {
    seedSession();
    render(<RequestCostButton />);
    const history = within(openDialog()).getByRole("region", { name: "Все запросы сессии" });
    const slotsRow = within(within(history).getByRole("table", { name: /Сочи у моря/ })).getAllByRole("row")[1];

    expect(slotsRow).toHaveTextContent(/без стриминга/);
  });

  it("resets the session", () => {
    seedSession();
    render(<RequestCostButton />);
    const dialog = openDialog();

    act(() => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Сбросить сессию" }));
    });

    expect(within(dialog).getByText(/Запросов к LLM в этой вкладке пока не было/)).toBeInTheDocument();
  });
});
