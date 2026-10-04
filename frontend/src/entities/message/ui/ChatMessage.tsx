import React from "react";
import { Message } from "../model/types";
import { cn } from "@/shared/lib";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessageItem({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full gap-3 py-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl border border-primary/30 bg-primary/20 text-primary shadow-sm">
          <Bot className="h-5 w-5" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-5 py-3 text-base leading-relaxed shadow-sm transition-all",
          isUser
            ? "rounded-tr-none bg-primary font-medium text-primary-foreground selection:bg-white/30 selection:text-white"
            : "rounded-tl-none border border-border bg-card text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        <div
          className={cn(
            "mt-1.5 text-xs font-medium",
            isUser ? "text-right text-primary-foreground/75" : "text-muted-foreground"
          )}
        >
          {message.timestamp}
        </div>
      </div>

      {isUser && (
        <div className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground shadow-sm">
          <User className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}
