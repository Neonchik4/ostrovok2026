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
    <div
      className={cn(
        "flex w-full gap-3 py-2",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/30">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-2.5 text-sm shadow-sm transition-all",
          isUser
            ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
            : "bg-card border border-border text-foreground rounded-tl-none"
        )}
      >
        <div className="whitespace-pre-wrap leading-relaxed">
          {message.content || (
            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Подбираю ответ...
            </span>
          )}
        </div>
        <div
          className={cn(
            "mt-1 text-[10px]",
            isUser ? "text-primary-foreground/70 text-right" : "text-muted-foreground"
          )}
        >
          {message.timestamp}
        </div>
      </div>

      {isUser && (
        <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-secondary text-secondary-foreground border border-border">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
