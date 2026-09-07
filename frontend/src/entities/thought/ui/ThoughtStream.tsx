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
    <div className="rounded-xl border border-border bg-card/60 p-3 text-xs space-y-2 mb-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 font-semibold text-primary">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
        <span>Ход рассуждений агента:</span>
      </div>

      <div className="space-y-1.5 pl-1">
        {thoughts.map((item, idx) => {
          const isLatest = idx === thoughts.length - 1 && isStreaming;
          return (
            <div key={idx} className="flex items-start gap-2 text-muted-foreground">
              {isLatest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0 mt-0.5" />
              ) : (
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <span className={isLatest ? "text-foreground font-medium" : ""}>
                {item.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
