import { LlmCallUsage, LlmRequestUsage } from "@/shared/api";

/**
 * Суммы только по известным значениям. Вызовы, по которым API не вернул токены
 * или цены нет в прайсе, считаются отдельно — итог тогда «не менее».
 */
export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  unknownTokenCalls: number;
  costUsd: number;
  unknownCostCalls: number;
}

export function sumCalls(calls: LlmCallUsage[]): UsageTotals {
  return calls.reduce<UsageTotals>(
    (acc, call) => ({
      calls: acc.calls + 1,
      inputTokens: acc.inputTokens + (call.input_tokens ?? 0),
      outputTokens: acc.outputTokens + (call.output_tokens ?? 0),
      totalTokens: acc.totalTokens + (call.total_tokens ?? 0),
      unknownTokenCalls: acc.unknownTokenCalls + (call.total_tokens === null ? 1 : 0),
      costUsd: acc.costUsd + (call.cost_usd ?? 0),
      unknownCostCalls: acc.unknownCostCalls + (call.cost_usd === null ? 1 : 0),
    }),
    {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      unknownTokenCalls: 0,
      costUsd: 0,
      unknownCostCalls: 0,
    }
  );
}

/** Стриминговый ответ агента — по нему считаются TTFT и скорость запроса. */
export function streamedAnswer(request: LlmRequestUsage): LlmCallUsage | undefined {
  const streamed = request.calls.filter((call) => call.streamed);
  return streamed.find((call) => call.stage === "response") ?? streamed[0];
}

/** Рубли — только если для каждого запроса с известной стоимостью сервер прислал курс. */
export function costInRub(requests: LlmRequestUsage[]): number | null {
  let rub = 0;
  for (const request of requests) {
    const { costUsd } = sumCalls(request.calls);
    if (costUsd === 0) continue;
    if (request.usdRubRate === null) return null;
    rub += costUsd * request.usdRubRate;
  }
  return rub;
}

export function sessionTotals(requests: LlmRequestUsage[]) {
  const totals = sumCalls(requests.flatMap((request) => request.calls));
  return { ...totals, requests: requests.length, costRub: costInRub(requests) };
}
