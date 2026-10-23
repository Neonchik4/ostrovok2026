/**
 * Network Transport with Fast Health Race (Auto-discovery)
 * Scans local dev port (8000) and compose port (8080) with 300ms race.
 */
const ENDPOINT_CANDIDATES = [
  "http://127.0.0.1:8000",
  "http://localhost:8080"
];

let cachedActiveBaseUrl = null;

export async function pingEndpoint(baseUrl, timeoutMs = 350) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`${baseUrl}/api/live/health`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      return data.status === "ok" ? baseUrl : null;
    }
  } catch {
    // Offline or unreachable
  }
  return null;
}

export async function getActiveBaseUrl() {
  if (cachedActiveBaseUrl) {
    const stillOk = await pingEndpoint(cachedActiveBaseUrl, 250);
    if (stillOk) return cachedActiveBaseUrl;
  }

  // Fast Race across candidates
  const checks = ENDPOINT_CANDIDATES.map((url) => pingEndpoint(url));
  const results = await Promise.all(checks);
  const found = results.find((r) => r !== null);

  if (found) {
    cachedActiveBaseUrl = found;
    return found;
  }

  // Default fallback
  cachedActiveBaseUrl = ENDPOINT_CANDIDATES[0];
  return cachedActiveBaseUrl;
}

export async function requestActionPlan(query, persona = "bro", availableFilters = [], pageType = "SERP") {
  const baseUrl = await getActiveBaseUrl();
  try {
    const resp = await fetch(`${baseUrl}/api/live/act`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        persona,
        current_url: window.location.href,
        available_filters: availableFilters,
        page_type: pageType,
      })
    });

    if (resp.ok) {
      return await resp.json();
    }
  } catch {
    // Offline
  }

  return getDeterministicFallbackPlan(query, persona);
}

export function getDeterministicFallbackPlan(query, persona) {
  const qLower = query.toLowerCase();
  const city = qLower.includes("питер") || qLower.includes("петербург")
    ? "Санкт-Петербург"
    : qLower.includes("москв")
    ? "Москва"
    : qLower.includes("казан")
    ? "Казань"
    : "Сочи";

  const speechMap = {
    bro: `Принято! Подбираю лучший вариант в ${city}. Сейчас открою выдачу и подсвечу отель.`,
    assistant: `Запрос принят. Анализирую параметры поездки в ${city}. Выполняю переход в каталог.`,
    concierge: `С удовольствием организую вашу поездку в ${city}. Представляю премиальную выборку.`
  };

  return {
    persona: persona || "bro",
    speech: speechMap[persona] || speechMap.bro,
    steps: [
      { action: "set_destination", selector: '[data-testid="destination-input"]', value: city, label: `Направление: ${city}` },
      { action: "submit_search", selector: '[data-testid="search-button"]', value: "", label: "Запуск поиска" },
      { action: "scroll_to_hotel", selector: '[data-testid="serp-hotelcard"]', value: "0", label: "Просмотр каталога" },
      { action: "highlight_hotel", selector: '[data-testid="serp-hotelcard"]', value: "96% совпадение • Подогреваемый бассейн", label: "Топовый выбор" }
    ]
  };
}
