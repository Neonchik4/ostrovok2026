"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./ghost-toggle.module.css";

type GhostToggleProps = {
  /** Контролируемое состояние. Если не передано — компонент управляет собой сам. */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

/** Длительность перелёта призрака, мс (совпадает с CSS). */
export const GHOST_TOGGLE_DURATION = 560;

export function GhostToggle({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  className,
  "aria-label": ariaLabel = "Переключить страницу",
}: GhostToggleProps) {
  const isControlled = checked !== undefined;
  const [inner, setInner] = useState(defaultChecked);
  const on = isControlled ? checked : inner;

  // Анимация полёта включается только после первого переключения,
  // чтобы при монтировании призрак не «пролетал» на месте.
  const [moved, setMoved] = useState(false);
  const prev = useRef(on);
  useEffect(() => {
    if (prev.current !== on) {
      prev.current = on;
      setMoved(true);
    }
  }, [on]);

  const toggle = () => {
    const next = !on;
    if (!isControlled) setInner(next);
    onCheckedChange?.(next);
  };

  const cls = [
    styles.toggle,
    on ? styles.isOn : styles.isOff,
    moved && styles.moved,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cls}
      onClick={toggle}
    >
      <span className={styles.knob}>
        <span className={styles.fly}>
          <span className={styles.lift}>
            <span className={styles.wig}>
              <span className={styles.bob}>
                <svg
                  className={styles.ghost}
                  width="38"
                  height="40"
                  viewBox="6 5 52 55"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    className={styles.body}
                    d="M8.32 30.72 A23.68 23.68 0 0 1 55.68 30.72 L55.68 51.96 Q47.79 60.96 39.89 53.96 Q32 60.96 24.11 53.96 Q16.21 60.96 8.32 51.96 L8.32 30.72 Z"
                  />
                  <g className={styles.blush}>
                    <ellipse cx="18.74" cy="42.72" rx="5.68" ry="3.41" />
                    <ellipse cx="45.26" cy="42.72" rx="5.68" ry="3.41" />
                  </g>
                  <g className={styles.eyesIdle}>
                    <g className={styles.blink}>
                      <circle cx="20.63" cy="33.72" r="3.6" fill="#111827" />
                      <circle cx="43.37" cy="33.72" r="3.6" fill="#111827" />
                      <circle cx="19.53" cy="32.82" r="1.1" fill="#FFFFFF" />
                      <circle cx="42.27" cy="32.82" r="1.1" fill="#FFFFFF" />
                    </g>
                  </g>
                  <g className={styles.eyesHappy}>
                    <path d="M17.21 32.61 A3.6 3.6 0 0 1 24.06 32.61" />
                    <path d="M39.94 32.61 A3.6 3.6 0 0 1 46.79 32.61" />
                  </g>
                </svg>
              </span>
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}
