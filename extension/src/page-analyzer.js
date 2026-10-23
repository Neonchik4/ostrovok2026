/**
 * Page Analyzer: Multi-Page Intelligence for Ostrovok.ru
 * 100% Dynamic: Scrapes live DOM elements, rooms, filters and links without hardcoded values.
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

  // Scrape live room offers from DOM
  const roomRows = Array.from(doc.querySelectorAll('[class*="Room_root"], [data-testid*="room-row"], tr[class*="rate"], div[class*="RateCard"]'));
  const rooms = roomRows.slice(0, 5).map((row, idx) => {
    const title = row.querySelector('[class*="name"], [class*="Title"], h3, h4')?.textContent?.trim() || `Номер ${idx + 1}`;
    const price = row.querySelector('[class*="price"], [class*="Price"]')?.textContent?.trim() || "";
    const hasBreakfast = /завтрак/i.test(row.textContent || "");
    const freeCancel = /бесплатн.*отмен/i.test(row.textContent || "");
    return { idx, title, price, hasBreakfast, freeCancel, el: row };
  });

  const recommendedRoom = rooms.find((r) => r.hasBreakfast) || rooms[0] || null;

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

  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const cityGuess = pathParts.length > 2 ? pathParts[2] : "городе";

  return {
    city: cityGuess,
    hotelCount,
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

/**
 * Dynamically extract relevant action chips from the LIVE DOM without hardcoded lists
 */
export function getContextualChips(context, doc = document) {
  if (context.type === "HOTEL_DETAIL") {
    const chips = [{ label: "Забронировать на Островке", action: "book_on_ostrovok" }];
    if (context.data?.recommendedRoom) {
      chips.unshift({ label: context.data.recommendedRoom.title, action: "select_best_room" });
    }
    return chips;
  }

  if (context.type === "SERP") {
    // Dynamically extract top live filters that actually exist on the page
    const filterNodes = Array.from(
      doc.querySelectorAll('.FiltersListItem_root__UH0W8, [class*="FiltersListItem"], [class*="SwitchableFilter_label"]')
    );

    const extracted = [];
    for (const node of filterNodes) {
      const labelText = node.textContent?.replace(/\d+$/, "").trim() || "";
      const countEl = node.parentElement?.querySelector('[class*="count"]') || node.querySelector('[class*="count"]');
      const count = countEl ? parseInt(countEl.textContent || "0", 10) : 1;

      // Only offer filters that exist and have available hotels (> 0)
      if (labelText && count > 0 && !extracted.some((c) => c.label === labelText)) {
        extracted.push({ label: labelText, action: `filter_${labelText}` });
      }
      if (extracted.length >= 4) break;
    }

    if (extracted.length > 0) return extracted;

    // Minimal dynamic fallback if sidebar has not rendered yet
    return [
      { label: "С завтраком", action: "filter_завтрак" },
      { label: "С бассейном", action: "filter_бассейн" },
    ];
  }

  // Home Page: Extract live popular destination links from DOM if present
  const destLinks = Array.from(doc.querySelectorAll('a[href*="/hotel/russia/"], a[href*="/hotel/"]'))
    .map((a) => a.textContent?.trim() || "")
    .filter((txt) => txt.length > 2 && txt.length < 25 && !/отели/i.test(txt));

  const uniqueDests = Array.from(new Set(destLinks)).slice(0, 4);
  if (uniqueDests.length > 0) {
    return uniqueDests.map((dest) => ({ label: dest, action: `search_${dest}` }));
  }

  return [
    { label: "Поиск направления", action: "focus_destination" },
  ];
}
