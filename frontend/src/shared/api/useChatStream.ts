"use client";

import { useState, useRef, useCallback } from "react";
import { readSSEStream } from "./sseReader";
import {
  ThoughtItem,
  updateThought,
  markThoughtCancelled,
  markThoughtError,
} from "./thoughtReducer";

export type { ThoughtItem };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ReviewItem {
  id: number | string;
  author: string;
  date: string;
  rating: number;
  plus: string;
  minus: string;
  room?: string;
  traveller_type?: string;
}

export interface ReviewsSummary {
  positive_highlights?: string[];
  negative_highlights?: string[];
  valid_reviews_count?: number;
  traveller_distribution?: Record<string, number>;
}

export interface HotelData {
  id: string;
  name: string;
  city: string;
  stars: number;
  area: string;
  area_type: string;
  address?: string;
  description?: string;
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
  amenities?: Record<string, boolean>;
  reviews?: ReviewItem[];
  reviews_summary?: ReviewsSummary;
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
  const [isThinking, setIsThinking] = useState(false);
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
      setIsThinking(false);
      setThoughts((prev) => markThoughtCancelled(prev));
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
        content: queryOptions?.disambiguation ? queryOptions.disambiguation : trimmed,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      const assistantMsgId = `assistant-${Date.now()}`;

      setMessages((prev) => [...prev, userMsg]);
      setThoughts([{ step: "reasoning", text: "Анализирую параметры запроса..." }]);
      setChips([]); // сброс старых чипсов при новом запросе
      setError(null);
      setIsStreaming(true);
      setIsThinking(true);

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
          if (
            !controller.signal.aborted &&
            (apiEndpoint.startsWith("/") || apiEndpoint.includes(":3000"))
          ) {
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

        await readSSEStream({
          stream: response.body,
          signal: controller.signal,
          onEvent: async ({ event, data }) => {
            if (event === "thought") {
              const step = data.step || "thought";
              const thoughtText = data.text || "";
              setThoughts((prev) => updateThought(prev, step, thoughtText));

              if (!controller.signal.aborted && step !== "reasoning") {
                await new Promise((resolve) => setTimeout(resolve, 30));
              }
            } else if (event === "token") {
              setIsThinking(false);
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
                  m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m
                );
              });
            } else if (event === "widget") {
              setIsThinking(false);
              if (data.type === "hotel_grid" && Array.isArray(data.hotels)) {
                setHotels(data.hotels);
                if (Array.isArray(data.disambiguation_chips)) {
                  setChips(data.disambiguation_chips);
                }
              }
            } else if (event === "done") {
              setIsThinking(false);
              setIsStreaming(false);
            }
          },
        });
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          console.log("Стрим прерван клиентом");
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : "Не удалось связаться с сервером поиска";
        console.error("Ошибка при стриминге:", err);
        setError(errorMessage);
        setThoughts((prev) => markThoughtError(prev, errorMessage));
      } finally {
        isSubmittingRef.current = false;
        if (abortControllerRef.current === controller) {
          setIsStreaming(false);
          setIsThinking(false);
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
    isThinking,
    error,
    sendMessage,
    stopStream,
  };
}
