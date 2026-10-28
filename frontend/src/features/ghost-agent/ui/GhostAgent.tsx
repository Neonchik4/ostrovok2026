"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { SCREEN_SWITCH_EVENT, ScreenSwitchDetail } from "@/shared/lib";
import { cn } from "@/shared/lib/utils";

import { parseGhostIntent } from "../lib/ghostIntentRouter";
import { GhostAction, GhostChatMessage } from "../model/types";
import styles from "./ghostAgent.module.css";
import { GhostChat } from "./GhostChat";
import { GhostFigure } from "./GhostFigure";

interface GhostAgentProps {
  onAction?: (action: GhostAction) => void;
  onSendPrompt?: (prompt: string) => void;
  currentThought?: string | null;
  isStreaming?: boolean;
}

type GhostSpot = "toggle" | "corner" | "chat";
type FlightKind = "arcDown" | "arcUp" | "hop";

interface GhostPose {
  x: number;
  y: number;
  s: number;
}

const GREETING: GhostChatMessage = {
  id: "greeting",
  role: "ghost",
  text: "Помогу вам настроить поиск",
};

/** Угол страницы: призрак 64×64, отступы 34px справа и 67px снизу — над логотипом Яндекс.Карт. */
const CORNER_OFFSET = { right: 34, bottom: 67, size: 64 };
const CORNER_POSE: GhostPose = { x: 0, y: 0, s: 1 };
/** Призрак 64px → ручка тумблера (тело 38px). */
const TOGGLE_SCALE = 0.73;
const ENTRY_FLIGHT_MS = 850;
const HOP_MS = 450;
const FLIGHT_EASING = "cubic-bezier(0.62, 0, 0.22, 1)";

let messageSeq = 0;
const createMessage = (role: GhostChatMessage["role"], text: string): GhostChatMessage => ({
  id: `${role}-${++messageSeq}`,
  role,
  text,
});

const toTransform = ({ x, y, s }: GhostPose, extra = "") =>
  `translate(${x}px, ${y}px) ${extra} scale(${s})`;

const lerp = (a: GhostPose, b: GhostPose, t: number): GhostPose => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  s: a.s + (b.s - a.s) * t,
});

function cornerCenter() {
  const half = CORNER_OFFSET.size / 2;
  return {
    x: window.innerWidth - CORNER_OFFSET.right - half,
    y: window.innerHeight - CORNER_OFFSET.bottom - half,
  };
}

/** Смещение до ручки тумблера в шапке (он пуст, пока призрак на странице, см. ScreenSwitch). */
function togglePose(isOn: boolean): GhostPose | null {
  const toggle = document.querySelector('[role="switch"][data-knob="hidden"]');
  const rect = toggle?.getBoundingClientRect();
  if (!rect?.width) return null;
  const corner = cornerCenter();
  // Ручка 38×40: translateX(-3px) выкл / 33px вкл, выступает на 5px над треком
  return {
    x: rect.left + (isOn ? 52 : 16) - corner.x,
    y: rect.top + 15 - corner.y,
    s: TOGGLE_SCALE,
  };
}

/** Призрак сидит на шапке чата: 12px от левого края, выступает на 40px. */
function chatPose(panel: HTMLElement): GhostPose {
  // Считаем от раскладки (offset*), а не getBoundingClientRect: окно в этот момент
  // ещё в анимации появления и уменьшено transform-ом
  const corner = cornerCenter();
  const half = CORNER_OFFSET.size / 2;
  return {
    x: panel.offsetLeft + 12 + half - corner.x,
    y: panel.offsetTop - 40 + half - corner.y,
    s: 1,
  };
}

function flightFrames(from: GhostPose, to: GhostPose, kind: FlightKind): Keyframe[] {
  if (kind === "hop") {
    const mid = lerp(from, to, 0.5);
    return [
      { transform: toTransform(from) },
      { transform: toTransform({ ...mid, y: mid.y - 28 }, "rotate(-8deg)"), offset: 0.5 },
      { transform: toTransform(to) },
    ];
  }
  // Дуга уходит влево от прямой, наклон — по ходу полёта (как arc-down/arc-up в макете)
  const tilt = kind === "arcDown" ? -1 : 1;
  const apex = lerp(from, to, 0.45);
  const settle = lerp(from, to, 0.8);
  return [
    { transform: toTransform(from) },
    {
      transform: toTransform({ ...apex, x: apex.x - 150 }, `rotate(${12 * tilt}deg)`),
      offset: 0.45,
    },
    {
      transform: toTransform({ ...settle, x: settle.x - 20 }, `rotate(${-4 * tilt}deg)`),
      offset: 0.8,
    },
    { transform: toTransform(to) },
  ];
}

/**
 * Плавающий Ghost-агент каталога (макет GhostFlow). Призрак прилетает из тумблера в шапке
 * в правый нижний угол, по клику прыгает на шапку компактного чата, а при уходе
 * с каталога улетает обратно в тумблер.
 */
export function GhostAgent({
  onAction,
  onSendPrompt,
  currentThought,
  isStreaming = false,
}: GhostAgentProps) {
  const [spot, setSpot] = useState<GhostSpot>("corner");
  const [isFlying, setIsFlying] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<GhostChatMessage[]>([GREETING]);
  const [isListening, setIsListening] = useState(false);

  const ghostRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const poseRef = useRef<GhostPose>(CORNER_POSE);
  const flightRef = useRef<Animation | null>(null);
  const spotRef = useRef<GhostSpot>("corner");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const moveTo = useCallback((nextSpot: GhostSpot) => {
    spotRef.current = nextSpot;
    setSpot(nextSpot);
  }, []);

  /** Мгновенно ставит призрака в позу, без анимации. */
  const place = useCallback((pose: GhostPose) => {
    poseRef.current = pose;
    if (ghostRef.current) ghostRef.current.style.transform = toTransform(pose);
  }, []);

  /** Перелёт только через transform (композитор), без пересчёта раскладки и тени. */
  const fly = useCallback(
    (to: GhostPose, kind: FlightKind, duration: number) => {
      const el = ghostRef.current;
      const from = poseRef.current;
      place(to);
      flightRef.current?.cancel();
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!el || typeof el.animate !== "function" || reduceMotion) return;

      setIsFlying(true);
      const flight = el.animate(flightFrames(from, to, kind), { duration, easing: FLIGHT_EASING });
      flightRef.current = flight;
      flight.onfinish = () => {
        if (flightRef.current === flight) setIsFlying(false);
      };
    },
    [place]
  );

  const addMessage = useCallback((role: GhostChatMessage["role"], text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.text === text) return prev;
      return [...prev, createMessage(role, text)];
    });
  }, []);

  // Появление: из тумблера в шапке — в угол страницы
  useLayoutEffect(() => {
    const fromToggle = togglePose(true);
    if (!fromToggle) return;
    place(fromToggle);
    fly(CORNER_POSE, "arcDown", ENTRY_FLIGHT_MS);
    return () => flightRef.current?.cancel();
  }, [place, fly]);

  // Шапка чата появилась — призрак прыгает на неё
  useLayoutEffect(() => {
    if (isChatOpen && panelRef.current) {
      fly(chatPose(panelRef.current), "hop", HOP_MS);
    }
  }, [isChatOpen, fly]);

  // Окно браузера или чат меняют размер (новые сообщения) — призрак остаётся на шапке чата
  useEffect(() => {
    const followHeader = () => {
      if (spotRef.current === "chat" && panelRef.current) place(chatPose(panelRef.current));
    };
    window.addEventListener("resize", followHeader);
    const observer =
      isChatOpen && panelRef.current && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(followHeader)
        : null;
    if (observer && panelRef.current) observer.observe(panelRef.current);
    return () => {
      window.removeEventListener("resize", followHeader);
      observer?.disconnect();
    };
  }, [place, isChatOpen]);

  // Уход с каталога: тумблер в шапке ждёт призрака обратно до смены роута
  useEffect(() => {
    const handleSwitch = (event: Event) => {
      const { to, duration } = (event as CustomEvent<ScreenSwitchDetail>).detail;
      if (to !== "agent") return;
      recognitionRef.current?.stop();
      setIsListening(false);
      setIsChatOpen(false);
      moveTo("toggle");
      const target = togglePose(false);
      if (target) fly(target, "arcUp", duration);
    };
    window.addEventListener(SCREEN_SWITCH_EVENT, handleSwitch);
    return () => window.removeEventListener(SCREEN_SWITCH_EVENT, handleSwitch);
  }, [fly, moveTo]);

  // Мысли агента из SSE-потока попадают в историю чата
  useEffect(() => {
    if (isStreaming && currentThought) {
      addMessage("ghost", currentThought);
    }
  }, [isStreaming, currentThought, addMessage]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const handleQuery = useCallback(
    (query: string) => {
      addMessage("user", query);
      const result = parseGhostIntent(query);

      if (result.handled && result.action) {
        addMessage("ghost", result.speechText);
        onAction?.(result.action);
      } else if (onSendPrompt) {
        onSendPrompt(query);
      }
    },
    [addMessage, onAction, onSendPrompt]
  );

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage("ghost", "Голосовой ввод не поддерживается в этом браузере");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          handleQuery(transcript);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const openChat = () => {
    if (isFlying || spot !== "corner") return;
    moveTo("chat");
    setIsChatOpen(true);
  };

  const closeChat = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setIsChatOpen(false);
    moveTo("corner");
    fly(CORNER_POSE, "hop", HOP_MS);
  };

  const isInCorner = spot === "corner" && !isFlying;

  return (
    <>
      {isInCorner && (
        <>
          {/* Облачко-подсказка: периодически всплывает рядом с призраком */}
          <div
            role="status"
            className={cn(
              styles.bubble,
              "pointer-events-none fixed bottom-[102px] right-[98px] z-40 h-[134px] w-[244px]"
            )}
          >
            <svg
              width="244"
              height="134"
              viewBox="0 0 244 134"
              aria-hidden="true"
              className={cn(styles.bubbleShape, "absolute inset-0 overflow-visible")}
            >
              <path
                d="M196.8 83.7 A106 50 0 1 0 163 98.3 Q195 122 232 124 Q210 108 196.8 83.7 Z"
                fill="#FFFFFF"
                stroke="#1652F0"
                strokeWidth="3.2"
                strokeLinejoin="round"
              />
            </svg>
            <span className="absolute left-1 top-[5px] flex h-[100px] w-[212px] items-center justify-center px-[30px] text-center text-sm font-semibold leading-[1.35] text-foreground">
              Я могу помочь настроить фильтры.
            </span>
          </div>

          {/* Кликабельная зона под призраком (сам призрак — летающий слой поверх) */}
          <button
            type="button"
            onClick={openChat}
            aria-label="Открыть чат с Ghost"
            className="fixed bottom-14 right-7 z-[45] flex h-[88px] w-[76px] items-end justify-center"
          >
            <span
              aria-hidden="true"
              className={cn(styles.landShadow, "h-[7px] w-10 rounded-full")}
            />
          </button>
        </>
      )}

      {isChatOpen && (
        <GhostChat
          ref={panelRef}
          messages={messages}
          onSubmitPrompt={handleQuery}
          isListening={isListening}
          onToggleVoice={toggleVoice}
          isThinking={isStreaming}
          onClose={closeChat}
        />
      )}

      {/* Единственный призрак: тумблер → угол → шапка чата и обратно */}
      <div
        ref={ghostRef}
        data-testid="ghost-flyer"
        aria-hidden="true"
        className={cn(
          styles.flyer,
          "pointer-events-none fixed bottom-[67px] right-[34px] z-50 h-16 w-16"
        )}
      >
        <div
          className={cn("h-16 w-16", !isFlying && (spot === "toggle" ? styles.bob : styles.float))}
        >
          <GhostFigure happy={spot === "chat"} />
        </div>
      </div>
    </>
  );
}
