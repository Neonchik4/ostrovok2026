import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ChatConcierge } from "@/widgets/ChatConcierge";

describe("ChatConcierge input behavior with voice listening", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders input as enabled when not listening and not streaming", () => {
    render(
      <ChatConcierge
        messages={[]}
        thoughts={[]}
        chips={[]}
        isStreaming={false}
        onSendMessage={vi.fn()}
        onStopStream={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Куда и как хотите поехать?...");
    expect(input).toBeEnabled();
    expect(input).not.toHaveAttribute("readonly");
  });

  it("disables input and submit button during active microphone listening", () => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = true;
      lang = "ru-RU";
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      onresult = null;
      onerror = null;
      onend = null;
    }

    (window as unknown as { webkitSpeechRecognition: typeof MockSpeechRecognition }).webkitSpeechRecognition =
      MockSpeechRecognition;

    const sendMessageMock = vi.fn();

    render(
      <ChatConcierge
        messages={[]}
        thoughts={[]}
        chips={[]}
        isStreaming={false}
        onSendMessage={sendMessageMock}
        onStopStream={vi.fn()}
      />
    );

    const micBtn = screen.getByTitle("Голосовой ввод запроса (Web Speech API)");
    expect(micBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(micBtn);
    });

    const input = screen.getByPlaceholderText("Слушаю вас, говорите... (ввод текста заблокирован)");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("readonly");

    const submitBtn = screen.getByTitle("Отправить");
    expect(submitBtn).toBeDisabled();
  });

  it("turns off microphone immediately when isStreaming becomes true", () => {
    const abortMock = vi.fn();
    const stopMock = vi.fn();

    class MockSpeechRecognition {
      continuous = false;
      interimResults = true;
      lang = "ru-RU";
      start = vi.fn();
      stop = stopMock;
      abort = abortMock;
      onresult = null;
      onerror = null;
      onend = null;
    }

    (window as unknown as { webkitSpeechRecognition: typeof MockSpeechRecognition }).webkitSpeechRecognition =
      MockSpeechRecognition;

    const { rerender } = render(
      <ChatConcierge
        messages={[]}
        thoughts={[]}
        chips={[]}
        isStreaming={false}
        onSendMessage={vi.fn()}
        onStopStream={vi.fn()}
      />
    );

    const micBtn = screen.getByTitle("Голосовой ввод запроса (Web Speech API)");
    act(() => {
      fireEvent.click(micBtn);
    });

    // Имитируем начало стриминга ответа
    act(() => {
      rerender(
        <ChatConcierge
          messages={[]}
          thoughts={[]}
          chips={[]}
          isStreaming={true}
          onSendMessage={vi.fn()}
          onStopStream={vi.fn()}
        />
      );
    });

    // Микрофон должен быть принудительно остановлен через abort или stop
    expect(abortMock.mock.calls.length + stopMock.mock.calls.length).toBeGreaterThan(0);
  });

  it("automatically stops microphone and sends message after speech recognition finishes", () => {
    let instance: any = null;
    const abortMock = vi.fn();

    class MockSpeechRecognition {
      continuous = false;
      interimResults = true;
      lang = "ru-RU";
      start = vi.fn(() => {
        instance = this;
      });
      stop = vi.fn();
      abort = abortMock;
      onresult: any = null;
      onerror: any = null;
      onend: any = null;
    }

    (window as unknown as { webkitSpeechRecognition: typeof MockSpeechRecognition }).webkitSpeechRecognition =
      MockSpeechRecognition;

    const sendMessageMock = vi.fn();

    render(
      <ChatConcierge
        messages={[]}
        thoughts={[]}
        chips={[]}
        isStreaming={false}
        onSendMessage={sendMessageMock}
        onStopStream={vi.fn()}
      />
    );

    const micBtn = screen.getByTitle("Голосовой ввод запроса (Web Speech API)");
    act(() => {
      fireEvent.click(micBtn);
    });

    expect(instance).not.toBeNull();

    // Имитируем получение финального результата распознавания
    act(() => {
      instance.onresult({
        results: [
          Object.assign([{ transcript: "Отель в Сочи" }], { isFinal: true, length: 1 }),
        ],
      });
    });

    // Микрофон должен быть немедленно освобожден
    expect(abortMock).toHaveBeenCalled();
    // Сообщение должно быть отправлено
    expect(sendMessageMock).toHaveBeenCalledWith("Отель в Сочи");

    // Инпут должен вернуться в нормальное состояние (разблокирован)
    const input = screen.getByPlaceholderText("Куда и как хотите поехать?...");
    expect(input).toBeEnabled();
  });

  it("automatically stops microphone after pause in speech when results are interim", () => {
    let instance: any = null;
    const abortMock = vi.fn();

    class MockSpeechRecognition {
      continuous = false;
      interimResults = true;
      lang = "ru-RU";
      start = vi.fn(() => {
        instance = this;
      });
      stop = vi.fn();
      abort = abortMock;
      onresult: any = null;
      onerror: any = null;
      onend: any = null;
    }

    (window as unknown as { webkitSpeechRecognition: typeof MockSpeechRecognition }).webkitSpeechRecognition =
      MockSpeechRecognition;

    const sendMessageMock = vi.fn();

    render(
      <ChatConcierge
        messages={[]}
        thoughts={[]}
        chips={[]}
        isStreaming={false}
        onSendMessage={sendMessageMock}
        onStopStream={vi.fn()}
      />
    );

    const micBtn = screen.getByTitle("Голосовой ввод запроса (Web Speech API)");
    act(() => {
      fireEvent.click(micBtn);
    });

    expect(instance).not.toBeNull();

    // Имитируем промежуточный результат (isFinal: false)
    act(() => {
      instance.onresult({
        results: [
          Object.assign([{ transcript: "Красная Поляна отель" }], { isFinal: false, length: 1 }),
        ],
      });
    });

    // До истечения таймера микрофон еще не остановлен
    expect(abortMock).not.toHaveBeenCalled();

    // Перематываем время на 850 мс (задержка тишины)
    act(() => {
      vi.advanceTimersByTime(850);
    });

    // Микрофон должен быть автоматически остановлен и текст отправлен
    expect(abortMock).toHaveBeenCalled();
    expect(sendMessageMock).toHaveBeenCalledWith("Красная Поляна отель");
  });
});

