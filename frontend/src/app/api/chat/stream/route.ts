import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function fetchUpstreamWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 6,
  delayMs = 600
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}

export async function POST(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const body = await req.text();

  try {
    const upstream = await fetchUpstreamWithRetry(`${backendUrl}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body,
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(upstream.statusText || "Upstream Error", {
        status: upstream.status,
      });
    }

    const { readable, writable } = new TransformStream();
    upstream.body.pipeTo(writable).catch((err) => {
      // Игнорируем штатный обрыв соединения клиентом
      if (err?.name !== "AbortError") {
        console.warn("[SSE Route Proxy] upstream pipe ended:", err?.message);
      }
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Proxy Error";
    console.error("[SSE Route Handler Error]:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const { searchParams } = new URL(req.url);

  try {
    const upstream = await fetchUpstreamWithRetry(`${backendUrl}/api/chat/stream?${searchParams.toString()}`, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(upstream.statusText || "Upstream Error", {
        status: upstream.status,
      });
    }

    const { readable, writable } = new TransformStream();
    upstream.body.pipeTo(writable).catch(() => {});

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Proxy Error";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
