"use client";

import { useState, useRef, useCallback } from "react";

export interface ThoughtItem {
  step: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface HotelData {
  id: string;
  name: string;
  city: string;
  stars: number;
  area: string;
  area_type: string;
  address?: string;
  rating: number;
  reviews_count: number;
  image_urls: string[];
  match_score_pct: number;
  tags: string[];
  min_price_per_night_rub: number;
  suitable_room?: {
    name: string;
    price_per_night_rub: number;
    bed_setup?: string;
    view?: string;
    has_balcony?: boolean;
    area_sqm?: number;
  };
  receipt?: {
    nights: number;
    price_per_night_rub: number;
    base_accommodation_cost_rub: number;
    pet_deposit_rub: number;
    resort_tax_rub: number;
    total_rub: number;
    is_free_cancellation: boolean;
    cancellation_deadline?: string;
  };
  distance_to_beach_m?: number;
  distance_to_ski_lift_m?: number;
}

export interface UseChatStreamOptions {
  apiEndpoint?: string;
}

export function useChatStream(options: UseChatStreamOptions = {}) {
  const { apiEndpoint = "/api/chat/stream" } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thoughts, setThoughts] = useState<ThoughtItem[]>([]);
  const [hotels, setHotels] = useState<HotelData[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);
  const conversationIdRef = useRef<string>("");
  if (!conversationIdRef.current) {
    conversationIdRef.current = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  const stopStream = useCallback(() => {
    isSubmittingRef.current = false;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      queryOptions?: {
        nights?: number;
        guests?: number;
        pets?: number;
        disambiguation?: string;
      }
    ) => {
      const trimmed = text.trim();
      if (!trimmed && !queryOptions?.disambiguation) return;
      if (isStreaming || isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      // Прерываем предыдущий стрим при новом запросе
      stopStream();

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: queryOptions?.disambiguation
          ? queryOptions.disambiguation
          : trimmed,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      const assistantMsgId = `assistant-${Date.now()}`;

      setMessages((prev) => [...prev, userMsg]);
      setThoughts([{ step: "reasoning", text: "Анализирую параметры запроса..." }]);
      setChips([]); // ← сброс старых чипсов при новом запросе
      setError(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestPayload = JSON.stringify({
        message: trimmed || (queryOptions?.disambiguation ?? ""),
        conversation_id: conversationIdRef.current,
        disambiguation_selection: queryOptions?.disambiguation,
        nights: queryOptions?.nights ?? 2,
        guests: queryOptions?.guests ?? 2,
        pets: queryOptions?.pets ?? 0,
      });

      try {
        let response: Response;
        try {
          response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            body: requestPayload,
            signal: controller.signal,
          });
        } catch (fetchErr) {
          // Если прокси /api/... вернул net::ERR_CONNECTION_REFUSED, пробуем прямой бэкенд 127.0.0.1:8000
          if (!controller.signal.aborted && (apiEndpoint.startsWith("/") || apiEndpoint.includes(":3000"))) {
            console.warn("Порт 3000 недоступен, автоматическое переключение на 127.0.0.1:8000...");
            response = await fetch("http://127.0.0.1:8000/api/chat/stream", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream",
              },
              body: requestPayload,
              signal: controller.signal,
            });
          } else {
            throw fetchErr;
          }
        }

        if (!response.ok) {
          throw new Error(`Ошибка сервера HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("Тело ответа пустое");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          if (controller.signal.aborted) {
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const eventBlocks = buffer.split("\n\n");
          buffer = eventBlocks.pop() || "";

          for (let i = 0; i < eventBlocks.length; i++) {
            const block = eventBlocks[i];
            if (!block.trim() || controller.signal.aborted) continue;

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
              const data = JSON.parse(dataStr);

              if (eventType === "thought") {
                const step = data.step || "thought";
                const text = data.text || "";
                setThoughts((prev) => {
                  const existingStepIdx = prev.findIndex((t) => t.step === step);
                  if (step === "reasoning") {
                    const first = prev[0];
                    if (first && first.step === "reasoning") {
                      const isPlaceholder = first.text === "Анализирую параметры запроса...";
                      return [
                        { ...first, text: isPlaceholder ? text : first.text + text },
                        ...prev.slice(1),
                      ];
                    }
                    return [{ step, text }, ...prev];
                  }

                  if (existingStepIdx !== -1) {
                    const updated = [...prev];
                    updated[existingStepIdx] = { step, text };
                    return updated;
                  }
                  return [...prev, { step, text }];
                });

                // Если в одном сетевом пакете пришло несколько блоков мыслей, даём React отрисовать каждый шаг
                if (eventBlocks.length > 1 && i < eventBlocks.length - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 30));
                }
              } else if (eventType === "token") {
                const chunk = data.content || "";
                setMessages((prev) => {
                  const existing = prev.find((m) => m.id === assistantMsgId);
                  if (!existing) {
                    return [
                      ...prev,
                      {
                        id: assistantMsgId,
                        role: "assistant",
                        content: chunk,
                        timestamp: new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      },
                    ];
                  }
                  return prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + chunk }
                      : m
                  );
                });

                // Пауза при отображении пакета токенов для плавности
                if (eventBlocks.length > 1 && i < eventBlocks.length - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 15));
                }
              } else if (eventType === "widget") {
                if (data.type === "hotel_grid" && Array.isArray(data.hotels)) {
                  setHotels(data.hotels);
                  if (Array.isArray(data.disambiguation_chips)) {
                    setChips(data.disambiguation_chips);
                  }
                }
              } else if (eventType === "done") {
                setIsStreaming(false);
              }
            } catch (jsonErr) {
              console.warn("Ошибка разбора SSE пакета:", jsonErr, dataStr);
            }
          }
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          console.log("Стрим прерван клиентом");
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : "Не удалось связаться с сервером поиска";
        console.error("Ошибка при стриминге:", err);
        setError(errorMessage);
        setThoughts((prev) => {
          const filtered = prev.filter((t) => t.text !== "Анализирую параметры запроса...");
          return [
            ...filtered,
            { step: "error", text: `Ошибка: ${errorMessage}. Попробуйте повторить запрос.` },
          ];
        });
      } finally {
        isSubmittingRef.current = false;
        // Завершаем стриминг только если это всё ещё активный запрос
        if (abortControllerRef.current === controller) {
          setIsStreaming(false);
          abortControllerRef.current = null;
        }
      }

    },
    [apiEndpoint, stopStream, isStreaming]
  );

  return {
    messages,
    thoughts,
    hotels,
    chips,
    isStreaming,
    error,
    sendMessage,
    stopStream,
  };
}
