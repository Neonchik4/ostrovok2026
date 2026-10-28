const STAGE_LABELS: Record<string, string> = {
  slots: "Разбор запроса",
  embedding: "Эмбеддинг поиска",
  thoughts: "Ход рассуждений",
  response: "Ответ агента",
};

const PAGE_LABELS: Record<string, string> = {
  "/": "Главная",
  "/catalog": "Каталог",
};

/** Данных нет — так и пишем, без нулей и прочерков вместо чисел. */
export const NOT_RECEIVED = "Не удалось получить";
export const NOT_RECEIVED_LOWER = "не удалось получить";

/** «по 1 вызову», «по 3 вызовам». */
export function byCalls(count: number): string {
  const abs = Math.abs(count);
  return `по ${abs} ${abs % 10 === 1 && abs % 100 !== 11 ? "вызову" : "вызовам"}`;
}

export const stageLabel = (stage: string) => STAGE_LABELS[stage] ?? stage;
export const pageLabel = (page: string) => PAGE_LABELS[page] ?? page;

const number = (value: number, options: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("ru-RU", options).format(value);

/** Доли цента: три значащие цифры, иначе обычные копейки/центы. */
function money(value: number): string {
  if (value === 0) return "0";
  return Math.abs(value) < 1
    ? number(value, { maximumSignificantDigits: 3 })
    : number(value, { maximumFractionDigits: 2 });
}

export const formatUsd = (value: number) => `${money(value)} $`;
export const formatRub = (value: number) => `${money(value)} ₽`;
export const formatTokens = (value: number) => number(value, { maximumFractionDigits: 0 });
export const formatRate = (value: number) => number(value, { maximumFractionDigits: 4 });

export function formatTtft(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return NOT_RECEIVED_LOWER;
  return ms < 1000 ? `${formatTokens(ms)} мс` : `${number(ms / 1000, { maximumFractionDigits: 1 })} с`;
}

export function formatSpeed(tokensPerSec: number | null | undefined): string {
  if (tokensPerSec === null || tokensPerSec === undefined) return NOT_RECEIVED_LOWER;
  return `${number(tokensPerSec, { maximumFractionDigits: 1 })} ток/с`;
}
