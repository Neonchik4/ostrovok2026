"use client";

import { useEffect, useRef,useState } from "react";

interface UseAudioVisualizerOptions {
  numBars?: number;
  minHeight?: number;
}

const DEFAULT_BARS = 5;
const DEFAULT_MIN_HEIGHT = 0.2;

export function useAudioVisualizer(isListening: boolean, options?: UseAudioVisualizerOptions) {
  const numBars = options?.numBars ?? DEFAULT_BARS;
  const minHeight = options?.minHeight ?? DEFAULT_MIN_HEIGHT;

  const [levels, setLevels] = useState<number[]>(() => Array(numBars).fill(minHeight));

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const cleanup = () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch {}
        analyserRef.current = null;
      }
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
        } catch {}
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== "closed") {
            audioContextRef.current.close().catch(() => {});
          }
        } catch {}
        audioContextRef.current = null;
      }
      setLevels(Array(numBars).fill(minHeight));
    };

    if (!isListening) {
      cleanup();
      return;
    }

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    let isCancelled = false;

    const startAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
        });

        if (isCancelled || !isListening) {
          stream.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
          return;
        }

        streamRef.current = stream;

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

        if (!AudioCtx) return;

        const audioContext = new AudioCtx();
        audioContextRef.current = audioContext;

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        if (isCancelled) {
          cleanup();
          return;
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.65;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const binRanges = [
          [1, 3],
          [3, 6],
          [6, 10],
          [10, 16],
          [16, 24],
        ];

        let lastUpdate = 0;
        const targetFps = 30;
        const intervalMs = 1000 / targetFps;

        const tick = (time: number) => {
          if (isCancelled) return;

          if (time - lastUpdate >= intervalMs) {
            lastUpdate = time;
            analyser.getByteFrequencyData(dataArray);

            const newLevels = binRanges.map(([start, end]) => {
              let sum = 0;
              let count = 0;
              for (let i = start; i < end && i < dataArray.length; i++) {
                sum += dataArray[i];
                count++;
              }
              const avg = count > 0 ? sum / count : 0;
              const normalized = avg / 255;
              const scaled = Math.min(
                1,
                minHeight + Math.pow(normalized, 0.8) * (1 - minHeight) * 1.3
              );
              return Math.round(scaled * 100) / 100;
            });

            setLevels(newLevels);
          }

          animFrameIdRef.current = requestAnimationFrame(tick);
        };

        animFrameIdRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.warn("Could not capture microphone for visualizer:", err);
      }
    };

    void startAudio();

    return () => {
      isCancelled = true;
      cleanup();
    };
  }, [isListening, numBars, minHeight]);

  return levels;
}
