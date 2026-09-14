export interface SSEEvent {
  event: string;
  data: any;
}

export interface ReadSSEStreamOptions {
  stream: ReadableStream<Uint8Array>;
  signal?: AbortSignal;
  maxBufferSize?: number;
  onEvent: (event: SSEEvent) => Promise<void> | void;
}

const DEFAULT_MAX_BUFFER_SIZE = 1024 * 1024; // 1 MB buffer limit (Secure by Design)

/**
 * Чистый низкоуровневый парсер Server-Sent Events (SSE).
 * Безопасен по памяти: защищен от переполнения буфера (Buffer Overflow DoS).
 */
export async function readSSEStream(options: ReadSSEStreamOptions): Promise<void> {
  const { stream, signal, maxBufferSize = DEFAULT_MAX_BUFFER_SIZE, onEvent } = options;

  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Защита от атаки переполнением буфера
      if (buffer.length > maxBufferSize) {
        console.warn("[sseReader] Превышен максимальный размер буфера SSE. Сброс...");
        buffer = "";
        continue;
      }

      const eventBlocks = buffer.split("\n\n");
      buffer = eventBlocks.pop() || "";

      for (let i = 0; i < eventBlocks.length; i++) {
        const block = eventBlocks[i];
        if (!block.trim() || signal?.aborted) continue;

        let eventType = "message";
        const dataLines: string[] = [];

        const lines = block.split(/\r?\n/);
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.substring(5).trim());
          }
        }

        if (dataLines.length === 0) continue;
        const dataStr = dataLines.join("\n");

        try {
          const parsedData = JSON.parse(dataStr);
          await onEvent({ event: eventType, data: parsedData });
        } catch (jsonErr) {
          console.warn("[sseReader] Ошибка разбора JSON в SSE:", jsonErr, dataStr);
        }
      }
    }
  } finally {
    if (typeof reader.releaseLock === "function") {
      reader.releaseLock();
    }
  }
}
