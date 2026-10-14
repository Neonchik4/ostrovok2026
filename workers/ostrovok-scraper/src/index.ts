/**
 * Cloudflare Worker: Ostrovok Scraper & Parser Proxy
 * Edge-based scraper for extracting hotel details, policies, and amenities.
 */

export interface Env {
  ENVIRONMENT: string;
  AUTH_TOKEN?: string;
}

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
  "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, cf-aig-authorization",
        },
      });
    }

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return Response.json({
        status: "ok",
        service: "ostrovok-scraper",
        env: env.ENVIRONMENT || "production",
      });
    }

    // Check auth token if configured
    const authHeader = request.headers.get("Authorization") || request.headers.get("cf-aig-authorization");
    if (env.AUTH_TOKEN && authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      if (url.pathname === "/api/hotel" && request.method === "POST") {
        const body = (await request.json()) as { url?: string; slug?: string };
        const targetUrl = body.url || (body.slug ? `https://ostrovok.ru/hotel/russia/${body.slug}/` : null);

        if (!targetUrl) {
          return Response.json({ error: "Missing hotel url or slug" }, { status: 400 });
        }

        const resp = await fetch(targetUrl, {
          headers: COMMON_HEADERS,
          redirect: "follow",
        });

        if (!resp.ok) {
          return Response.json(
            { error: `Ostrovok returned status ${resp.status}`, status: resp.status },
            { status: resp.status }
          );
        }

        const html = await resp.text();
        const extracted = parseHotelHtml(html, targetUrl);

        return Response.json({
          success: true,
          data: extracted,
          url: targetUrl,
        });
      }

      if (url.pathname === "/api/search" && request.method === "POST") {
        const body = (await request.json()) as { query?: string; city?: string };
        const query = body.query || body.city || "Москва";
        const searchUrl = `https://ostrovok.ru/hotel/russia/?q=${encodeURIComponent(query)}`;

        const resp = await fetch(searchUrl, {
          headers: COMMON_HEADERS,
          redirect: "follow",
        });

        if (!resp.ok) {
          return Response.json(
            { error: `Search failed with status ${resp.status}` },
            { status: resp.status }
          );
        }

        const html = await resp.text();
        const hotels = parseSearchHtml(html);

        return Response.json({
          success: true,
          query,
          count: hotels.length,
          hotels,
        });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: "Internal error", details: message }, { status: 500 });
    }
  },
};

function parseHotelHtml(html: string, sourceUrl: string): Record<string, unknown> {
  const result: Record<string, unknown> = {
    source_url: sourceUrl,
    extracted_at: new Date().toISOString(),
  };

  // 1. Try extracting JSON-LD structured metadata
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (jsonLdMatch && jsonLdMatch[1]) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1]);
      result.json_ld = parsed;
      if (parsed.name) result.name = parsed.name;
      if (parsed.description) result.description = parsed.description;
      if (parsed.image) result.images = Array.isArray(parsed.image) ? parsed.image : [parsed.image];
      if (parsed.aggregateRating) {
        result.rating = parsed.aggregateRating.ratingValue;
        result.reviews_count = parsed.aggregateRating.reviewCount;
      }
    } catch {
      // Non-fatal if JSON-LD parse fails
    }
  }

  // 2. Extract meta tags
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch && !result.name) {
    result.name = titleMatch[1].replace(/—.*$/, "").trim();
  }

  // 3. Extract text sections for policies and amenities
  result.has_pool = /бассейн|pool/i.test(html);
  result.has_spa = /спа|spa|сауна|баня/i.test(html);
  result.pet_friendly = /животными|питомц/i.test(html) && !/без животных|животные запрещены/i.test(html);

  return result;
}

function parseSearchHtml(html: string): Array<Record<string, unknown>> {
  const hotels: Array<Record<string, unknown>> = [];
  const regex = /data-hotel-id="([^"]+)"[\s\S]*?class="[^"]*hotel-name[^"]*"[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && hotels.length < 20) {
    hotels.push({
      id: match[1],
      name: match[2].trim(),
    });
  }
  return hotels;
}
