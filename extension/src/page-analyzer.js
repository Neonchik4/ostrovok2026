/**
 * Page Analyzer: Multi-Page Intelligence for Ostrovok.ru
 * Distinguishes Home, SERP, and Hotel Detail pages, scraping live DOM context & logistics.
 */

export function detectPageContext(url = window.location.href, doc = document) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const search = urlObj.search;

  // 1. Hotel Detail Page: e.g. /hotel/russia/krasnodar/mid9250755/parallel_hotel/...
  if (pathname.includes("/hotel/") && (pathname.includes("/mid") || doc.querySelector('[class*="Room"], [data-testid*="room"], [class*="rates"]'))) {
    return {
      type: "HOTEL_DETAIL",
      data: analyzeHotelDetailPage(doc, urlObj),
    };
  }

  // 2. SERP (Search Results Page): e.g. /hotel/russia/krasnodar/?search=yes...
  if (search.includes("search=yes") || (pathname.includes("/hotel/") && !pathname.includes("/mid"))) {
    return {
      type: "SERP",
      data: analyzeSerpPage(doc, urlObj),
    };
  }

  // 3. Home Page: root or destination input present
  const destInput = doc.querySelector('[data-testid="destination-input"], input[placeholder*="Куда"], input[name="destination"]');
  if (pathname === "/" || pathname === "" || destInput) {
    return {
      type: "HOME",
      data: analyzeHomePage(doc, urlObj),
    };
  }

  return {
    type: "GENERIC",
    data: { url: urlObj.href },
  };
}

export function analyzeHotelDetailPage(doc, urlObj) {
  const nameEl = doc.querySelector('h1, [data-testid*="hotel-name"], [class*="HotelHeader_name"]');
  const hotelName = nameEl?.textContent?.trim() || "Отель";

  const ratingEl = doc.querySelector('[data-testid*="rating"], [class*="Rating_value"]');
  const rating = ratingEl?.textContent?.trim() || "8.8";

  const addrEl = doc.querySelector('[class*="Address"], [data-testid*="address"], [class*="HotelHeader_address"]');
  const address = addrEl?.textContent?.trim() || "";

  const distEl = doc.querySelector('[class*="Distance"], [data-testid*="distance"], [class*="Geo_root"]');
  const distanceSummary = distEl?.textContent?.trim() || "";

  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const city = pathParts.length > 2 ? pathParts[2] : "";

  // Scrape room offers
  const roomRows = Array.from(doc.querySelectorAll('[class*="Room_root"], [data-testid*="room-row"], tr[class*="rate"], div[class*="RateCard"]'));
  const rooms = roomRows.slice(0, 5).map((row, idx) => {
    const title = row.querySelector('[class*="name"], [class*="Title"], h3, h4')?.textContent?.trim() || `Номер ${idx + 1}`;
    const price = row.querySelector('[class*="price"], [class*="Price"]')?.textContent?.trim() || "";
    const hasBreakfast = /завтрак/i.test(row.textContent || "");
    const freeCancel = /бесплатн.*отмен/i.test(row.textContent || "");
    return { idx, title, price, hasBreakfast, freeCancel, el: row };
  });

  // Determine smart recommendation (best rate with breakfast or first option)
  let recommendedRoom = rooms.find((r) => r.hasBreakfast) || rooms[0] || null;

  return {
    hotelName,
    rating,
    address,
    distanceSummary,
    city,
    roomsCount: rooms.length,
    rooms,
    recommendedRoom,
  };
}

export function analyzeSerpPage(doc, urlObj) {
  const cards = Array.from(doc.querySelectorAll('[data-testid="serp-hotelcard"], [class*="HotelCard"], [class*="zen-hotelcard"]'));
  const hotelCount = cards.length;

  // Extract location from query params or header
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const cityGuess = pathParts.length > 2 ? pathParts[2] : "городе";

  // Check available filter checkboxes
  const filterLabels = Array.from(doc.querySelectorAll("label, [role='checkbox'], [class*='FilterCheckbox']"));
  const hasBreakfastFilter = filterLabels.some((l) => /завтрак/i.test(l.textContent || ""));
  const hasPoolFilter = filterLabels.some((l) => /бассейн/i.test(l.textContent || ""));
  const hasParkingFilter = filterLabels.some((l) => /парковк/i.test(l.textContent || ""));
  const hasPetFilter = filterLabels.some((l) => /питомц|животн/i.test(l.textContent || ""));

  return {
    city: cityGuess,
    hotelCount,
    hasBreakfastFilter,
    hasPoolFilter,
    hasParkingFilter,
    hasPetFilter,
  };
}

export function analyzeHomePage(doc, urlObj) {
  const destInput = doc.querySelector('[data-testid="destination-input"], input[placeholder*="Куда"], input[name="destination"]');
  const searchBtn = doc.querySelector('[data-testid="search-button"], button[type="submit"]');

  return {
    hasDestinationInput: Boolean(destInput),
    hasSearchButton: Boolean(searchBtn),
  };
}

export function getContextualChips(context) {
  switch (context.type) {
    case "HOTEL_DETAIL":
      return [
        { label: "Выбрать лучший номер", action: "select_best_room" },
        { label: "Забронировать на Островке", action: "book_on_ostrovok" },
        { label: "Маршрут и логистика", action: "show_route_planner" },
      ];
    case "SERP":
      return [
        { label: "Включить завтрак", action: "toggle_breakfast" },
        { label: "С бассейном", action: "toggle_pool" },
        { label: "Ближе к центру", action: "filter_center" },
        { label: "Топ по отзывам", action: "highlight_top" },
      ];
    case "HOME":
    default:
      return [
        { label: "Краснодар 24-25 окт", action: "search_krasnodar" },
        { label: "Сочи с бассейном", action: "search_sochi" },
        { label: "Питер командировка", action: "search_spb" },
      ];
  }
}
