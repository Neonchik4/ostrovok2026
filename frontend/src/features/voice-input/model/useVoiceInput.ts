"use client";

import { useState, useCallback, useEffect, useRef } from "react";

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
}

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: new () => ISpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => ISpeechRecognitionInstance;
}

export function useVoiceInput(onTranscript?: (text: string) => void) {
  // Начинаем с false — одинаково и на сервере, и при hydration.
  // После монтирования useEffect поставит реальное значение.
  // Это единственный корректный паттерн для browser-only API в Next.js SSR.
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  // onTranscript в ref — не попадает в зависимости useEffect
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const recognitionRef = useRef<ISpeechRecognitionInstance | null>(null);

  // Создаём Recognition ровно один раз после монтирования — deps: []
  useEffect(() => {
    if (typeof window === "undefined") return;

    const w = window as unknown as IWindowWithSpeech;
    const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Constructor) return;

    setIsSupported(true);

    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ru-RU";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          onTranscriptRef.current?.(item[0].transcript);
          setInterimTranscript("");
        } else {
          interim += item[0].transcript;
        }
      }
      if (interim) {
        setInterimTranscript(interim);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []); // ← пустые зависимости: один раз при монтировании

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript("");
    } else {
      try {
        setInterimTranscript("");
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn("Speech recognition start failed:", err);
      }
    }
  }, [isListening]);

  return {
    isListening,
    isSupported,
    interimTranscript,
    toggleListening,
  };
}

