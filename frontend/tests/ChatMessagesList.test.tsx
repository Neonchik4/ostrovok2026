import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatMessagesList } from "@/widgets/ChatConcierge";
import { Message } from "@/entities/message";
import { Thought } from "@/entities/thought";

describe("ChatMessagesList (Single Responsibility Component)", () => {
  it("renders empty state placeholder when there are no messages", () => {
    const scrollRef = { current: null };
    const messagesEndRef = { current: null };

    render(
      <ChatMessagesList
        messages={[]}
        thoughts={[]}
        isStreaming={false}
        scrollRef={scrollRef}
        messagesEndRef={messagesEndRef}
      />
    );

    expect(screen.getByText("О!дин запрос — и отель найден")).toBeInTheDocument();
  });

  it("renders user and assistant messages in correct order", () => {
    const scrollRef = { current: null };
    const messagesEndRef = { current: null };

    const messages: Message[] = [
      { id: "1", role: "user", content: "Хочу в Сочи", timestamp: "12:00" },
      { id: "2", role: "assistant", content: "Подобрал отличные отели в Сочи", timestamp: "12:01" },
    ];

    render(
      <ChatMessagesList
        messages={messages}
        thoughts={[]}
        isStreaming={false}
        scrollRef={scrollRef}
        messagesEndRef={messagesEndRef}
      />
    );

    expect(screen.getByText("Хочу в Сочи")).toBeInTheDocument();
    expect(screen.getByText("Подобрал отличные отели в Сочи")).toBeInTheDocument();
  });

  it("renders thought stream between user prompt and assistant response", () => {
    const scrollRef = { current: null };
    const messagesEndRef = { current: null };

    const messages: Message[] = [
      { id: "1", role: "user", content: "Отель со спа", timestamp: "12:00" },
      { id: "2", role: "assistant", content: "Вот варианты со спа-комплексом", timestamp: "12:01" },
    ];

    const thoughts: Thought[] = [
      { step: "search", text: "Выполняю семантический поиск по спа-отелям..." },
    ];

    render(
      <ChatMessagesList
        messages={messages}
        thoughts={thoughts}
        isStreaming={false}
        scrollRef={scrollRef}
        messagesEndRef={messagesEndRef}
      />
    );

    const toggleButton = screen.getByRole("button", { name: /Ход рассуждений агента/i });
    expect(toggleButton).toBeInTheDocument();
    fireEvent.click(toggleButton);
    expect(screen.getByText("Выполняю семантический поиск по спа-отелям...")).toBeInTheDocument();
  });
});
