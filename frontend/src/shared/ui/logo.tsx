import * as React from "react";

import { cn } from "../lib/utils";

type LogoVariant = "mark" | "wordmark";

interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: LogoVariant;
  /** Height in pixels; width scales via object-contain. */
  size?: number;
}

const ASSETS: Record<LogoVariant, { src: string; alt: string; ratio: number }> = {
  // Official Ostrovok brand mark ("О!") and wordmark, served from /public.
  mark: { src: "/ostrovok-mark.png", alt: "Островок", ratio: 1 },
  wordmark: { src: "/ostrovok-logo.svg", alt: "Островок", ratio: 130 / 40 },
};

/**
 * Renders the official Ostrovok brand asset. The artwork lives as a static file
 * in /public (not re-drawn in code), so the trademark stays pixel-accurate.
 */
export function Logo({ variant = "mark", size = 44, className, ...props }: LogoProps) {
  const asset = ASSETS[variant];
  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ height: size, width: size * asset.ratio }}
      {...props}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.src}
        alt={asset.alt}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}
