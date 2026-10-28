import React from "react";

interface GhostFigureProps {
  /** Довольные глаза-дуги (в чате) вместо круглых (в покое). */
  happy?: boolean;
  size?: number;
}

/** Векторный призрак Островка — тот же, что в тумблере шапки (`GhostToggle`). */
export function GhostFigure({ happy = false, size = 64 }: GhostFigureProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ filter: "drop-shadow(0 6px 10px rgba(22,82,240,.22))" }}
    >
      <path
        d="M8.32 30.72 A23.68 23.68 0 0 1 55.68 30.72 L55.68 51.96 Q47.79 60.96 39.89 53.96 Q32 60.96 24.11 53.96 Q16.21 60.96 8.32 51.96 L8.32 30.72 Z"
        fill="#FFFFFF"
        stroke="#1652F0"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <g fill="#FF8CA0" fillOpacity="0.45">
        <ellipse cx="18.74" cy="42.72" rx="5.68" ry="3.41" />
        <ellipse cx="45.26" cy="42.72" rx="5.68" ry="3.41" />
      </g>
      {happy ? (
        <g stroke="#111827" strokeWidth="2.4" strokeLinecap="round">
          <path d="M17.21 32.61 A3.6 3.6 0 0 1 24.06 32.61" />
          <path d="M39.94 32.61 A3.6 3.6 0 0 1 46.79 32.61" />
        </g>
      ) : (
        <g>
          <circle cx="20.63" cy="33.72" r="3.6" fill="#111827" />
          <circle cx="43.37" cy="33.72" r="3.6" fill="#111827" />
          <circle cx="19.53" cy="32.82" r="1.1" fill="#FFFFFF" />
          <circle cx="42.27" cy="32.82" r="1.1" fill="#FFFFFF" />
        </g>
      )}
    </svg>
  );
}
