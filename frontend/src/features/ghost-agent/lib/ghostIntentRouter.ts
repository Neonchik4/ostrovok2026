import { GhostAction, ThoughtStep } from "../model/types";

export interface IntentMatchResult {
  handled: boolean;
  action?: GhostAction;
  thoughts: ThoughtStep[];
  speechText: string;
}

export function parseGhostIntent(query: string): IntentMatchResult {
  const q = query.toLowerCase().trim();
  const now = Date.now();

  // 1. Сброс фильтров
  if (q.includes("сброс") || q.includes("очист") || q.includes("верни все") || q.includes("по умолчанию")) {
    return {
      handled: true,
      action: { type: "reset" },
      speechText: "Сбросил все активные фильтры каталога",
      thoughts: [
        { id: `t-${now}-1`, tag: "intent", text: `Запрос на очистку параметров: «${query}»`, timestamp: now },
        { id: `t-${now}-2`, tag: "action", text: "Сбрасываю фильтры каталога к значениям по умолчанию", timestamp: now + 50 },
        { id: `t-${now}-3`, tag: "success", text: "Каталог отелей возвращен в исходное состояние", timestamp: now + 100 },
      ],
    };
  }

  // 2. Бюджет / Цена
  const priceMatch = q.match(/(?:до|дешевле|не дороже|до)\s*(\d+[\s\d]*)\s*(?:₽|руб|к|тыс)?/i);
  if (priceMatch) {
    let rawNum = priceMatch[1].replace(/\s+/g, "");
    let price = parseInt(rawNum, 10);
    if (q.includes("тыс") || q.includes("к")) {
      price = price * 1000;
    }
    if (!isNaN(price) && price >= 500 && price <= 200000) {
      return {
        handled: true,
        action: { type: "set_price", value: price },
        speechText: `Установил фильтр бюджета до ${price.toLocaleString("ru-RU")} ₽`,
        thoughts: [
          { id: `t-${now}-1`, tag: "intent", text: `Извлечен ценовой лимит: до ${price} ₽`, timestamp: now },
          { id: `t-${now}-2`, tag: "action", text: `Корректирую ценовой слайдер каталога на ${price} ₽`, timestamp: now + 50 },
          { id: `t-${now}-3`, tag: "success", text: `Отобраны отели в диапазоне до ${price} ₽ / ночь`, timestamp: now + 100 },
        ],
      };
    }
  }

  // 3. Звездность
  if (q.includes("5 звезд") || q.includes("пять звезд") || q.includes("люкс")) {
    return {
      handled: true,
      action: { type: "set_stars", value: 5 },
      speechText: "Показываю только отели 5 звезд",
      thoughts: [
        { id: `t-${now}-1`, tag: "intent", text: "Фильтр категории: отели 5 звезд (Luxury)", timestamp: now },
        { id: `t-${now}-2`, tag: "action", text: "Активирую фильтр 5★ в панели фильтрации", timestamp: now + 50 },
        { id: `t-${now}-3`, tag: "success", text: "В выдаче оставлены только 5-звездочные отели", timestamp: now + 100 },
      ],
    };
  }
  if (q.includes("4 звезд") || q.includes("четыре звезд")) {
    return {
      handled: true,
      action: { type: "set_stars", value: 4 },
      speechText: "Показываю отели от 4 звезд",
      thoughts: [
        { id: `t-${now}-1`, tag: "intent", text: "Фильтр категории: отели 4★ и выше", timestamp: now },
        { id: `t-${now}-2`, tag: "action", text: "Активирую фильтр 4★", timestamp: now + 50 },
        { id: `t-${now}-3`, tag: "success", text: "Применен фильтр категории 4★+", timestamp: now + 100 },
      ],
    };
  }

  // 4. Удобства
  const amenitiesMap: Array<{ pattern: RegExp; key: string; label: string }> = [
    { pattern: /(?:бассейн|поплавать|водн|pool)/, key: "pool", label: "Теплый бассейн" },
    { pattern: /(?:завтрак|еда|питани|breakfast)/, key: "breakfast", label: "Завтрак включен" },
    { pattern: /(?:спа|spa|саун|баня|массаж)/, key: "spa", label: "СПА-комплекс" },
    { pattern: /(?:собак|кошк|питомц|животн|dog|pet)/, key: "pets", label: "Можно с питомцами" },
    { pattern: /(?:отмен|бесплатная отмена|cancellation)/, key: "freeCancellation", label: "Бесплатная отмена" },
  ];

  for (const item of amenitiesMap) {
    if (item.pattern.test(q)) {
      return {
        handled: true,
        action: { type: "toggle_filter", key: item.key, value: true },
        speechText: `Включил фильтр: ${item.label}`,
        thoughts: [
          { id: `t-${now}-1`, tag: "intent", text: `Распознан запрос на удобство: «${item.label}»`, timestamp: now },
          { id: `t-${now}-2`, tag: "action", text: `Отмечаю чекбокс «${item.label}» в React-состоянии`, timestamp: now + 50 },
          { id: `t-${now}-3`, tag: "success", text: `Список отелей отфильтрован по удобству «${item.label}»`, timestamp: now + 100 },
        ],
      };
    }
  }

  // 5. Выбор отеля
  if (q.includes("первый отель") || q.includes("лучший отель") || q.includes("покажи лучший") || q.includes("выбери первый")) {
    return {
      handled: true,
      action: { type: "select_hotel" },
      speechText: "Выбрал отель с максимальным совпадением",
      thoughts: [
        { id: `t-${now}-1`, tag: "intent", text: "Запрос на выбор отеля с наивысшим Match Score", timestamp: now },
        { id: `t-${now}-2`, tag: "action", text: "Фокусирую карточку топ-отеля на странице и карте", timestamp: now + 50 },
        { id: `t-${now}-3`, tag: "success", text: "Карточка подсвечена, открываю подробности", timestamp: now + 100 },
      ],
    };
  }

  // Не распознано локально — передаем в общий AI-пайплайн
  return {
    handled: false,
    action: { type: "prompt", text: query },
    speechText: `Ищу подходящие варианты: «${query.slice(0, 30)}...»`,
    thoughts: [
      { id: `t-${now}-1`, tag: "intent", text: `Сложный пользовательский запрос: «${query}»`, timestamp: now },
      { id: `t-${now}-2`, tag: "ai", text: "Передаю запрос в гибридный RAG-контур Gemini AI", timestamp: now + 50 },
    ],
  };
}
