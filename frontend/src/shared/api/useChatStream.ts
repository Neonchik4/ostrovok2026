"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { appendLlmUsage, LlmRequestMeta, LlmUsagePayload } from "./llmUsageStore";
import { readSSEStream } from "./sseReader";
import {
  markThoughtCancelled,
  markThoughtError,
  ThoughtItem,
  updateThought,
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

export interface HotelReviewSummaryData {
  rating: number;
  reviews_count: number;
  pros: string[];
  cons: string[];
}

export interface CriterionMatch {
  criterion: string;
  status: "code_verified" | "semantic_match" | "relaxed_compromise";
  evidence: string;
  is_positive: boolean;
}

export interface NearestHubData {
  hub_id: string;
  name: string;
  hub_type: "airport" | "train_station";
  distance_km: number;
  travel_time_min: number;
  taxi_time_min: number;
  taxi_cost_rub: number;
}

export interface FlightTicketData {
  origin: string;
  destination: string;
  airline: string;
  flight_number?: string;
  departure_at: string;
  arrival_at?: string;
  price_rub: number;
  booking_url: string;
  duration_min?: number;
  is_direct: boolean;
}

export interface TrainTicketData {
  origin: string;
  destination: string;
  train_number?: string;
  departure_at?: string;
  arrival_at?: string;
  price_from_rub: number;
  booking_url: string;
}

export interface TransportSummaryData {
  origin_city: string;
  destination_city: string;
  recommended_flight?: FlightTicketData;
  cheapest_flight?: FlightTicketData;
  recommended_train?: TrainTicketData;
  arrival_time?: string;
  preferred_mode?: string;
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
    transfer_cost_rub?: number;
    flight_ticket_rub?: number;
    train_ticket_rub?: number;
    transport_ticket_rub?: number;
    ticket_price_per_person_rub?: number;
    tickets_count?: number;
    transport_type?: "flight" | "train";
    transport_name?: string;
    total_rub: number;
    total_with_transport_rub?: number;
    is_free_cancellation: boolean;
    cancellation_deadline?: string;
    transfer_note?: string;
    arrival_warning?: string;
  };
  distance_to_beach_m?: number;
  distance_to_ski_lift_m?: number;
  checkin_from?: string;
  checkout_until?: string;
  has_24h_front_desk?: boolean;
  has_early_checkin?: boolean;
  has_luggage_storage?: boolean;
  nearest_hub?: NearestHubData;
  nearest_station?: NearestHubData;
  nearest_airport?: NearestHubData;
  coordinates?: {
    lat: number;
    lon: number;
  };
  amenities?: Record<string, boolean>;
  reviews?: ReviewItem[];
  top_reviews?: ReviewItem[];
  reviews_summary?: ReviewsSummary;
  review_summary?: HotelReviewSummaryData;
  criteria_breakdown?: CriterionMatch[];
  compromise_note?: string;
  checkout_url?: string;
  master_id?: number;
  slug?: string;
}

export interface UseChatStreamOptions {
  apiEndpoint?: string;
}

const STORAGE_KEY_HOTELS = "ostrovok_cached_hotels";
const STORAGE_KEY_TRANSPORT = "ostrovok_cached_transport";

function getCachedHotels(): HotelData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_HOTELS);
    return raw ? (JSON.parse(raw) as HotelData[]) : [];
  } catch {
    return [];
  }
}

function getCachedTransport(): TransportSummaryData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_TRANSPORT);
    return raw ? (JSON.parse(raw) as TransportSummaryData) : null;
  } catch {
    return null;
  }
}

export function useChatStream(options: UseChatStreamOptions = {}) {
  const { apiEndpoint = "/api/chat/stream" } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thoughts, setThoughts] = useState<ThoughtItem[]>([]);
  // Кэш из sessionStorage читаем только после гидрации: на сервере его нет,
  // и ленивая инициализация useState давала рассинхрон разметки (hydration error).
  const [hotels, setHotels] = useState<HotelData[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [transportSummary, setTransportSummary] = useState<TransportSummaryData | null>(null);
  const [isCacheRestored, setIsCacheRestored] = useState(false);
  const [offlineMode, setOfflineMode] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedHotels = getCachedHotels();
    const cachedTransport = getCachedTransport();
    // Не затираем данные, если их уже успели выставить до восстановления кэша.
    if (cachedHotels.length > 0) {
      setHotels((prev) => (prev.length > 0 ? prev : cachedHotels));
    }
    if (cachedTransport) {
      setTransportSummary((prev) => prev ?? cachedTransport);
    }
    setIsCacheRestored(true);
  }, []);

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

      // Вызовы LLM этого запроса копятся в сессии вкладки (окно Request Cost)
      const usageMeta: LlmRequestMeta = {
        id: `request-${Date.now()}`,
        message: trimmed || (queryOptions?.disambiguation ?? ""),
        page: window.location.pathname,
        startedAt: new Date().toISOString(),
      };

      try {
        // Same-origin in production (Traefik) and development (Next.js proxy).
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: requestPayload,
          signal: controller.signal,
        });

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
            } else if (event === "mode") {
              // Zero-Config Offline Mode: статусная плашка автономного агента (Issue #46)
              if (data.offline) {
                setOfflineMode(data.message || "Демо-режим (автономный эвристический агент)");
              }
            } else if (event === "widget") {
              setIsThinking(false);
              if (data.type === "hotel_grid" && Array.isArray(data.hotels)) {
                setHotels(data.hotels);
                if (typeof window !== "undefined") {
                  try {
                    sessionStorage.setItem(STORAGE_KEY_HOTELS, JSON.stringify(data.hotels));
                  } catch {}
                }
                if (Array.isArray(data.disambiguation_chips)) {
                  setChips(data.disambiguation_chips);
                }
                if (data.transport_summary) {
                  setTransportSummary(data.transport_summary);
                  if (typeof window !== "undefined") {
                    try {
                      sessionStorage.setItem(
                        STORAGE_KEY_TRANSPORT,
                        JSON.stringify(data.transport_summary)
                      );
                    } catch {}
                  }
                }
              }
            } else if (event === "llm_usage") {
              appendLlmUsage(usageMeta, data as LlmUsagePayload);
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

  const restoreSharedTrip = useCallback(
    (payload: {
      hotels: HotelData[];
      userMessage?: string;
      assistantMessage?: string;
      transportSummary?: TransportSummaryData | null;
      chips?: string[];
    }) => {
      stopStream();
      setHotels(payload.hotels);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(STORAGE_KEY_HOTELS, JSON.stringify(payload.hotels));
        } catch {}
      }
      if (payload.transportSummary !== undefined) {
        setTransportSummary(payload.transportSummary ?? null);
        if (typeof window !== "undefined") {
          try {
            if (payload.transportSummary) {
              sessionStorage.setItem(
                STORAGE_KEY_TRANSPORT,
                JSON.stringify(payload.transportSummary)
              );
            } else {
              sessionStorage.removeItem(STORAGE_KEY_TRANSPORT);
            }
          } catch {}
        }
      }
      if (payload.chips) {
        setChips(payload.chips);
      }

      const newMessages: ChatMessage[] = [];
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (payload.userMessage) {
        newMessages.push({
          id: `restored-user-${Date.now()}`,
          role: "user",
          content: payload.userMessage,
          timestamp,
        });
      }

      if (payload.assistantMessage) {
        newMessages.push({
          id: `restored-assistant-${Date.now()}`,
          role: "assistant",
          content: payload.assistantMessage,
          timestamp,
        });
      }

      setMessages(newMessages);
      setThoughts([]);
      setError(null);
      setIsStreaming(false);
      setIsThinking(false);
    },
    [stopStream]
  );

  return {
    messages,
    thoughts,
    hotels,
    chips,
    transportSummary,
    isCacheRestored,
    offlineMode,
    isStreaming,
    isThinking,
    error,
    sendMessage,
    stopStream,
    restoreSharedTrip,
  };
}
