"use client";

import { Check, Share2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui";

import { buildShareTripUrl } from "../lib/shareTripUrl";
import { TripShareState } from "../model/types";

// Сколько показывать «Ссылка скопирована…» вместо подписи кнопки
const COPIED_MESSAGE_MS = 1000;

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
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    []
  );

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
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_MESSAGE_MS);
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
            {copied ? "Ссылка скопирована в буфер обмена" : label}
          </span>
        )}
      </Button>

      {/* Сообщение показывается в самой кнопке; здесь — только для скринридеров */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Ссылка скопирована в буфер обмена" : ""}
      </span>
    </div>
  );
}
