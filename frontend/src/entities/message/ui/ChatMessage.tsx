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
        <div className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-sm">
          <Bot className="h-5 w-5" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-5 py-3 text-base shadow-sm transition-all leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
            : "bg-card border border-border text-foreground rounded-tl-none"
        )}
      >
        <div className="whitespace-pre-wrap">
          {message.content || (
            <span className="inline-flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Подбираю отели...
            </span>
          )}
        </div>
        <div
          className={cn(
            "mt-1.5 text-xs font-medium",
            isUser ? "text-primary-foreground/75 text-right" : "text-muted-foreground"
          )}
        >
          {message.timestamp}
        </div>
      </div>

      {isUser && (
        <div className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl bg-secondary text-secondary-foreground border border-border shadow-sm">
          <User className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}
