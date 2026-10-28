"use client";

import React from "react";

import { clearLlmUsage, LlmCallUsage, LlmRequestUsage, useLlmUsage } from "@/shared/api";
import {
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

import {
  byCalls,
  formatRate,
  formatRub,
  formatSpeed,
  formatTokens,
  formatTtft,
  formatUsd,
  NOT_RECEIVED,
  NOT_RECEIVED_LOWER,
  pageLabel,
  stageLabel,
} from "../lib/format";
import { costInRub, sessionTotals, streamedAnswer, sumCalls, UsageTotals } from "../lib/usageSummary";

function Metric({
  testId,
  label,
  value,
  hints = [],
}: {
  testId: string;
  label: string;
  value: string;
  hints?: string[];
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-1 rounded-xl border border-border bg-background p-3"
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-bold text-foreground">{value}</dd>
      {hints.map((hint) => (
        <dd key={hint} className="text-xs text-muted-foreground">
          {hint}
        </dd>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `request-cost-${title.replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-sm font-bold text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Значение по известным вызовам: всё неизвестно — «не удалось получить», часть — «не менее». */
function partial(known: string, unknownCalls: number, totalCalls: number) {
  if (unknownCalls === 0) return { value: known, hints: [] };
  if (unknownCalls === totalCalls) return { value: NOT_RECEIVED, hints: [] };
  return { value: `не менее ${known}`, hints: [`${byCalls(unknownCalls)} данные не получены`] };
}

function CostMetric({
  testId,
  totals,
  costRub,
}: {
  testId: string;
  totals: UsageTotals;
  costRub: number | null;
}) {
  const cost = partial(formatUsd(totals.costUsd), totals.unknownCostCalls, totals.calls);
  const known = totals.unknownCostCalls < totals.calls;
  const rub =
    known && costRub !== null
      ? `${totals.unknownCostCalls > 0 ? "не менее " : ""}${formatRub(costRub)}`
      : null;
  return (
    <Metric
      testId={testId}
      label="Стоимость"
      value={cost.value}
      hints={[...(rub ? [rub] : []), ...cost.hints]}
    />
  );
}

function TokensMetric({ testId, totals }: { testId: string; totals: UsageTotals }) {
  const tokens = partial(formatTokens(totals.totalTokens), totals.unknownTokenCalls, totals.calls);
  const split =
    totals.unknownTokenCalls < totals.calls
      ? [`вход ${formatTokens(totals.inputTokens)} · выход ${formatTokens(totals.outputTokens)}`]
      : [];
  return (
    <Metric testId={testId} label="Токенов" value={tokens.value} hints={[...split, ...tokens.hints]} />
  );
}

function LatestRequest({ request }: { request: LlmRequestUsage }) {
  const totals = sumCalls(request.calls);
  const answer = streamedAnswer(request);
  const hasTtft = answer?.ttft_ms !== null && answer?.ttft_ms !== undefined;
  const hasSpeed =
    answer?.output_tokens_per_sec !== null && answer?.output_tokens_per_sec !== undefined;
  return (
    <Section title="Последний запрос">
      <p className="text-sm text-muted-foreground">
        «{request.message}» · {pageLabel(request.page)}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CostMetric testId="metric-cost" totals={totals} costRub={costInRub([request])} />
        <TokensMetric testId="metric-tokens" totals={totals} />
        <Metric
          testId="metric-ttft"
          label="TTFT ответа"
          value={hasTtft ? formatTtft(answer?.ttft_ms) : NOT_RECEIVED}
          hints={["до первого токена"]}
        />
        <Metric
          testId="metric-speed"
          label="Скорость"
          value={hasSpeed ? formatSpeed(answer?.output_tokens_per_sec) : NOT_RECEIVED}
          hints={["генерация ответа"]}
        />
      </dl>
    </Section>
  );
}

const tokens = (value: number | null) => (value === null ? NOT_RECEIVED_LOWER : formatTokens(value));

function CallRow({ call }: { call: LlmCallUsage }) {
  return (
    <TableRow>
      <TableCell className="p-2">{stageLabel(call.stage)}</TableCell>
      <TableCell className="p-2 text-muted-foreground">{call.model}</TableCell>
      <TableCell className="p-2 text-right">
        {call.input_tokens === null || call.output_tokens === null
          ? NOT_RECEIVED_LOWER
          : `${formatTokens(call.input_tokens)} / ${formatTokens(call.output_tokens)}`}
      </TableCell>
      <TableCell className="p-2 text-right">{tokens(call.total_tokens)}</TableCell>
      <TableCell className="p-2 text-right">
        {call.streamed ? formatTtft(call.ttft_ms) : "без стриминга"}
      </TableCell>
      <TableCell className="p-2 text-right">{formatSpeed(call.output_tokens_per_sec)}</TableCell>
      <TableCell className="p-2 text-right">
        {call.cost_usd === null ? NOT_RECEIVED_LOWER : formatUsd(call.cost_usd)}
        {call.gateway_cache_hit && (
          <span className="block text-muted-foreground">кэш шлюза</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function RequestCalls({ request }: { request: LlmRequestUsage }) {
  return (
    <Table className="text-xs">
      <TableCaption className="mb-2 mt-0 text-left text-xs [caption-side:top]">
        «{request.message}» · {pageLabel(request.page)}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Этап</TableHead>
          <TableHead>Модель</TableHead>
          <TableHead className="text-right">Вход / выход</TableHead>
          <TableHead className="text-right">Всего</TableHead>
          <TableHead className="text-right">TTFT</TableHead>
          <TableHead className="text-right">Скорость</TableHead>
          <TableHead className="text-right">Стоимость</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {request.calls.map((call, index) => (
          <CallRow key={index} call={call} />
        ))}
      </TableBody>
    </Table>
  );
}

function SessionTotals({ requests }: { requests: LlmRequestUsage[] }) {
  const totals = sessionTotals(requests);
  const rate = requests.find((request) => request.usdRubRate !== null)?.usdRubRate ?? null;
  const pricing = requests.find((request) => request.pricing)?.pricing ?? null;
  return (
    <Section title="Итого за сессию">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric testId="total-requests" label="Запросов" value={formatTokens(totals.requests)} />
        <Metric testId="total-calls" label="Вызовов LLM" value={formatTokens(totals.calls)} />
        <TokensMetric testId="total-tokens" totals={totals} />
        <CostMetric testId="total-cost" totals={totals} costRub={totals.costRub} />
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {totals.costRub === null || rate === null ? (
          <>Курс USD → RUB на сервере не задан (USD_RUB_RATE): стоимость в рублях не показана. </>
        ) : (
          <>Курс {formatRate(rate)} ₽ за $1 (USD_RUB_RATE). </>
        )}
        {pricing ? (
          <>
            Цены — прайс Gemini API (Paid Tier, Standard) от {pricing.updated}:{" "}
            <a
              href={pricing.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              ai.google.dev
            </a>
            . Модели, которых нет в прайсе, не оцениваются.
          </>
        ) : (
          <>Прайс моделей получить не удалось.</>
        )}
      </p>
    </Section>
  );
}

/** Отчёт по реальным вызовам LLM в сессии вкладки: последний запрос, история и итог. */
export function RequestCostReport() {
  const requests = useLlmUsage();

  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Запросов к LLM в этой вкладке пока не было. Задайте вопрос в чате на главной или
        Ghost-агенту в каталоге.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <LatestRequest request={requests[0]} />

      <Section title="Все запросы сессии">
        <div className="flex flex-col gap-4">
          {requests.map((request) => (
            <RequestCalls key={request.id} request={request} />
          ))}
        </div>
      </Section>

      <SessionTotals requests={requests} />

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={clearLlmUsage}>
          Сбросить сессию
        </Button>
      </div>
    </div>
  );
}
