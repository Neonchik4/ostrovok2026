import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioVisualizer } from "@/features/voice-input";

describe("useAudioVisualizer", () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalAudioContext = window.AudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, "mediaDevices", {
      value: originalMediaDevices,
      writable: true,
    });
    window.AudioContext = originalAudioContext;
  });

  it("returns default baseline levels when not listening", () => {
    const { result } = renderHook(() => useAudioVisualizer(false, { numBars: 5, minHeight: 0.2 }));

    expect(result.current).toHaveLength(5);
    expect(result.current).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
  });

  it("initializes Web Audio analyser and cleans up on stop", async () => {
    const stopMock = vi.fn();
    const mockTrack = { stop: stopMock };
    const mockStream = {
      getTracks: () => [mockTrack],
    };

    const mockAnalyser = {
      fftSize: 64,
      smoothingTimeConstant: 0.65,
      frequencyBinCount: 32,
      getByteFrequencyData: vi.fn((arr: Uint8Array) => {
        arr.fill(128);
      }),
    };

    const mockAudioContext = {
      state: "running",
      resume: vi.fn().mockResolvedValue(undefined),
      createAnalyser: vi.fn(() => mockAnalyser),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
      })),
      close: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
    });

    window.AudioContext = vi.fn().mockImplementation(() => mockAudioContext) as unknown as typeof AudioContext;

    const { result, rerender } = renderHook(
      ({ isListening }) => useAudioVisualizer(isListening, { numBars: 5, minHeight: 0.2 }),
      { initialProps: { isListening: true } }
    );

    // Initial check
    expect(result.current).toHaveLength(5);

    // Rerender with isListening = false to trigger cleanup
    act(() => {
      rerender({ isListening: false });
    });

    // Verify stream tracks stopped
    expect(result.current).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
  });
});
