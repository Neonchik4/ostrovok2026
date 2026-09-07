import React from "react";
import { Thought } from "../model/types";
import { Sparkles, Check, Loader2 } from "lucide-react";

interface ThoughtStreamProps {
  thoughts: Thought[];
  isStreaming: boolean;
}

export function ThoughtStream({ thoughts, isStreaming }: ThoughtStreamProps) {
  if (thoughts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4 text-sm space-y-3 mb-4 backdrop-blur-md shadow-sm">
      <div className="flex items-center gap-2 font-bold text-primary text-sm">
        <Sparkles className="h-4 w-4 animate-pulse" />
        <span>Ход рассуждений агента:</span>
      </div>

      <div className="space-y-2 pl-1">
        {thoughts.map((item, idx) => {
          const isLatest = idx === thoughts.length - 1 && isStreaming;
          return (
            <div key={idx} className="flex items-start gap-2.5 text-muted-foreground">
              {isLatest ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
              ) : (
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <span className={isLatest ? "text-foreground font-semibold" : "leading-relaxed"}>
                {item.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
