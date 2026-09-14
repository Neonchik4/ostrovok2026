import { describe, it, expect, vi } from "vitest";
import { readSSEStream, SSEEvent } from "@/shared/api";

function createReadableStreamFromStrings(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe("sseReader (Secure by Design)", () => {
  it("parses single and multi-line SSE events", async () => {
    const rawData = [
      "event: thought\ndata: {\"step\": \"search\", \"text\": \"Поиск...\"}\n\n",
      "event: token\ndata: {\"content\": \"Найден отель\"}\n\n",
      "event: done\ndata: {\"status\": \"ok\"}\n\n",
    ];

    const stream = createReadableStreamFromStrings(rawData);
    const events: SSEEvent[] = [];

    await readSSEStream({
      stream,
      onEvent: (ev) => {
        events.push(ev);
      },
    });

    expect(events.length).toBe(3);
    expect(events[0]).toEqual({
      event: "thought",
      data: { step: "search", text: "Поиск..." },
    });
    expect(events[1]).toEqual({
      event: "token",
      data: { content: "Найден отель" },
    });
    expect(events[2]).toEqual({
      event: "done",
      data: { status: "ok" },
    });
  });

  it("handles events split across multiple stream chunks", async () => {
    const splitChunks = [
      "event: tho",
      "ught\nda",
      "ta: {\"step\": \"par",
      "sing\"}\n\n",
    ];

    const stream = createReadableStreamFromStrings(splitChunks);
    const events: SSEEvent[] = [];

    await readSSEStream({
      stream,
      onEvent: (ev) => {
        events.push(ev);
      },
    });

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      event: "thought",
      data: { step: "parsing" },
    });
  });

  it("stops reading when AbortSignal is triggered", async () => {
    const controller = new AbortController();
    const chunks = [
      "event: thought\ndata: {\"step\": \"1\"}\n\n",
      "event: thought\ndata: {\"step\": \"2\"}\n\n",
    ];

    const stream = createReadableStreamFromStrings(chunks);
    const events: SSEEvent[] = [];

    await readSSEStream({
      stream,
      signal: controller.signal,
      onEvent: (ev) => {
        events.push(ev);
        controller.abort();
      },
    });

    expect(events.length).toBe(1);
  });

  it("protects against buffer overflow with maxBufferSize (Secure by Design)", async () => {
    // Бесконечный поток без разделителей \n\n превышающий maxBufferSize
    const hugeChunk = "data: " + "A".repeat(200);
    const stream = createReadableStreamFromStrings([hugeChunk]);
    const events: SSEEvent[] = [];

    await readSSEStream({
      stream,
      maxBufferSize: 100, // ограничение 100 байт
      onEvent: (ev) => {
        events.push(ev);
      },
    });

    // Из-за сброса переполненного буфера битый пакет не распарсился
    expect(events.length).toBe(0);
  });
});
