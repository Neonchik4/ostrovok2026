import { AlertCircle, ChevronDown, ChevronUp, HelpCircle, ShieldCheck } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { CriterionMatch } from "../model/types";

interface HotelScoreBadgeProps {
  scorePct: number;
  criteriaBreakdown?: CriterionMatch[];
  className?: string;
}

export function HotelScoreBadge({ scorePct, criteriaBreakdown = [], className = "" }: HotelScoreBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasBreakdown = criteriaBreakdown && criteriaBreakdown.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Без обоснования бейдж не несет информации, поэтому не рендерится
  if (!hasBreakdown) return null;

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${isOpen ? "z-50" : "z-20"} ${className}`}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-label={`Оценка соответствия ${scorePct}%. Нажмите для подробного обоснования`}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-extrabold text-foreground shadow-lg backdrop-blur-md transition-all hover:border-primary/60 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
      >
        <HelpCircle className="h-4 w-4 shrink-0 text-primary" />
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Обоснование соответствия отеля"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-card p-4 shadow-2xl animate-in fade-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Обоснование Match Score
            </span>
            <span className="text-xs font-black text-primary">{scorePct}%</span>
          </div>

          <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {criteriaBreakdown.map((item, idx) => {
              const isVerified = item.status === "code_verified";
              const isCompromise = item.status === "relaxed_compromise";

              return (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-2 text-xs"
                >
                  <div className="mt-0.5 shrink-0">
                    {isVerified ? (
                      <ShieldCheck className="h-4 w-4 text-success" />
                    ) : isCompromise ? (
                      <AlertCircle className="h-4 w-4 text-warning" />
                    ) : (
                      <HelpCircle className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-foreground">{item.criterion}</span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isVerified
                            ? "text-success"
                            : isCompromise
                            ? "text-warning"
                            : "text-primary"
                        }`}
                      >
                        {isVerified
                          ? "Код"
                          : isCompromise
                          ? "Компромисс"
                          : "Вектор"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{item.evidence}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 border-t border-border pt-2 text-[10px] text-muted-foreground">
            Проверено по базе данных и векторной семантике отзывов
          </div>
        </div>
      )}
    </div>
  );
}
