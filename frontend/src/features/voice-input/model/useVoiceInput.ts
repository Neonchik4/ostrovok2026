"use client";

import { useCallback, useEffect, useRef,useState } from "react";

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechend?: (() => void) | null;
  onaudioend?: (() => void) | null;
}

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: new () => ISpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => ISpeechRecognitionInstance;
}

// Задержка тишины после последнего НОВОГО слова до автоотключения (мс) — даем 2 секунды спокойно договорить
const SILENCE_AFTER_SPEECH_MS = 2000;
// Задержка фиксации при сигнале окончания речи/звука от браузера (мс)
const SPEECH_END_GRACE_MS = 1500;
// Таймаут на случай, если пользователь включил микрофон и ничего не сказал (мс)
const NO_SPEECH_TIMEOUT_MS = 10000;

export function useVoiceInput(onTranscript?: (text: string) => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const recognitionRef = useRef<ISpeechRecognitionInstance | null>(null);
  const currentTranscriptRef = useRef("");
  const lastRecordedTextRef = useRef("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxIdleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Проверка поддержки в браузере при монтировании
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as IWindowWithSpeech;
    const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (Constructor) {
      setIsSupported(true);
    }
  }, []);

  // Очистка всех таймеров
  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxIdleTimerRef.current) {
      clearTimeout(maxIdleTimerRef.current);
      maxIdleTimerRef.current = null;
    }
  }, []);

  // Принудительное и полное выключение микрофона
  const stopListening = useCallback(() => {
    clearTimers();
    currentTranscriptRef.current = "";
    lastRecordedTextRef.current = "";

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.onspeechend = null;
        rec.onaudioend = null;
        rec.abort(); // Немедленно глушит микрофон на уровне браузера и ОС
      } catch (err) {
        console.warn("Speech recognition abort error:", err);
      }
    }

    setIsListening(false);
    setInterimTranscript("");
  }, [clearTimers]);

  // Фиксация надиктованного текста, немедленная остановка микрофона и отправка
  const commitAndStop = useCallback(
    (text: string) => {
      clearTimers();
      const trimmed = text.trim();

      // Сначала глушим микрофон
      stopListening();

      // Затем отправляем надиктованный текст
      if (trimmed) {
        onTranscriptRef.current?.(trimmed);
      }
    },
    [clearTimers, stopListening]
  );

  // Запуск сессии распознавания речи
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as IWindowWithSpeech;
    const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Constructor) return;

    // Сброс предыдущей сессии
    stopListening();

    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ru-RU";

    currentTranscriptRef.current = "";
    lastRecordedTextRef.current = "";

    // Таймаут на случай, если пользователь вообще ничего не скажет после включения
    maxIdleTimerRef.current = setTimeout(() => {
      if (!currentTranscriptRef.current) {
        stopListening();
      }
    }, NO_SPEECH_TIMEOUT_MS);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Отменяем таймер пустого ожидания, так как звук/речь пошла
      if (maxIdleTimerRef.current) {
        clearTimeout(maxIdleTimerRef.current);
        maxIdleTimerRef.current = null;
      }

      let accumulated = "";

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        if (item && item[0]) {
          accumulated += item[0].transcript;
        }
      }

      const trimmed = accumulated.trim();
      if (trimmed) {
        currentTranscriptRef.current = trimmed;
        setInterimTranscript(trimmed);
      }

      // Детекция паузы в речи:
      // Перезапускаем таймер тишины (2 секунды) ТОЛЬКО если текст изменился (появились новые слова).
      // Если браузер шлет повторные interim-события с тем же текстом — таймер продолжает отсчет.
      if (trimmed && trimmed !== lastRecordedTextRef.current) {
        lastRecordedTextRef.current = trimmed;
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          if (currentTranscriptRef.current) {
            commitAndStop(currentTranscriptRef.current);
          }
        }, SILENCE_AFTER_SPEECH_MS);
      }
    };

    // Событие окончания речи от браузера
    recognition.onspeechend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        if (currentTranscriptRef.current) {
          commitAndStop(currentTranscriptRef.current);
        } else {
          stopListening();
        }
      }, SPEECH_END_GRACE_MS);
    };

    // Событие окончания звука в потоке
    recognition.onaudioend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        if (currentTranscriptRef.current) {
          commitAndStop(currentTranscriptRef.current);
        } else {
          stopListening();
        }
      }, SPEECH_END_GRACE_MS);
    };

    recognition.onend = () => {
      if (currentTranscriptRef.current) {
        commitAndStop(currentTranscriptRef.current);
      } else {
        stopListening();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error !== "no-speech" && currentTranscriptRef.current) {
        commitAndStop(currentTranscriptRef.current);
      } else {
        stopListening();
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.warn("Speech recognition start failed:", err);
      stopListening();
    }
  }, [stopListening, commitAndStop]);

  // Переключение состояния микрофона пользователем
  const toggleListening = useCallback(() => {
    if (isListening) {
      // Если пользователь вручную нажал кнопку выключения во время речи — сохраняем сказанное
      if (currentTranscriptRef.current) {
        commitAndStop(currentTranscriptRef.current);
      } else {
        stopListening();
      }
    } else {
      startListening();
    }
  }, [isListening, stopListening, commitAndStop, startListening]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isSupported,
    interimTranscript,
    toggleListening,
    stopListening,
  };
}
