const ORDER_PREFIX = "OST-DEMO-2026";

/**
 * Генерирует детерминированный номер демо-заказа по id отеля (Issue #47).
 * Один и тот же отель всегда даёт один и тот же номер: djb2-хеш без
 * обращения к Date.now и Math.random — устойчиво к перерендерам и тестам.
 */
export function generateDemoOrderNumber(hotelId: string): string {
  const clean = (hotelId || "").trim();
  let hash = 5381;
  for (let i = 0; i < clean.length; i += 1) {
    hash = ((hash << 5) + hash + clean.charCodeAt(i)) >>> 0;
  }
  const code = 1000 + (hash % 9000);
  return `${ORDER_PREFIX}-${code}`;
}
