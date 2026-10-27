"use client";

import { Check, Share2 } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/shared/ui";

import { buildShareTripUrl } from "../lib/shareTripUrl";
import { TripShareState } from "../model/types";

interface ShareTripButtonProps {
  state?: TripShareState;
  url?: string;
  label?: string;
  compact?: boolean;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ShareTripButton({
  state,
  url,
  label = "Поделиться поездкой",
  compact = false,
  variant = "outline",
  size = "sm",
  className = "",
}: ShareTripButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetUrl = url || (state ? buildShareTripUrl(state) : (typeof window !== "undefined" ? window.location.href : "/"));

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(targetUrl);
      }
    } catch {
      // Fallback: prompt or input select
      if (typeof document !== "undefined") {
        const input = document.createElement("input");
        input.value = targetUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
    }

    setCopied(true);
    setTimeout(() => {
      setCopied(false), 2500;
    }, 2500);
  };

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleShare}
        title="Поделиться готовой поездкой"
        className={`gap-1.5 transition-all ${className}`}
      >
        {copied ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Share2 className="h-4 w-4 text-primary" />
        )}
        {!compact && (
          <span className="text-xs font-semibold">
            {copied ? "Скопировано" : label}
          </span>
        )}
      </Button>

      {/* Всплывающий тост об успешном копировании */}
      {copied && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-card/95 px-4 py-3 text-xs font-bold text-foreground shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
          </div>
          <span>Ссылка скопирована в буфер обмена</span>
        </div>
      )}
    </div>
  );
}
