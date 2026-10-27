"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/lib/utils";
import { GHOST_TOGGLE_DURATION, GhostToggle } from "@/shared/ui";

const CONCIERGE_PATH = "/";
const CATALOG_PATH = "/catalog";

/**
 * Переключатель экранов AI Консьерж (/) <-> Каталог Островка (/catalog).
 * Призрак сначала долетает до нового положения, и только потом меняется роут,
 * поэтому новая страница монтируется с тумблером уже в конечном состоянии.
 */
export function ScreenSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCatalog, setIsCatalog] = useState(pathname === CATALOG_PATH);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Синхронизация с роутом (например, навигация «назад» в браузере)
  useEffect(() => {
    setIsCatalog(pathname === CATALOG_PATH);
  }, [pathname]);

  useEffect(() => {
    router.prefetch(pathname === CATALOG_PATH ? CONCIERGE_PATH : CATALOG_PATH);
  }, [pathname, router]);

  useEffect(
    () => () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
    },
    []
  );

  const switchTo = (toCatalog: boolean) => {
    if (pendingRef.current || toCatalog === isCatalog) return;
    setIsCatalog(toCatalog);
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      router.push(toCatalog ? CATALOG_PATH : CONCIERGE_PATH);
    }, GHOST_TOGGLE_DURATION);
  };

  const labelClass = (active: boolean) =>
    cn(
      "text-sm font-semibold transition-colors",
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <nav aria-label="Переключатель экранов" className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => switchTo(false)}
        aria-current={!isCatalog ? "page" : undefined}
        className={labelClass(!isCatalog)}
      >
        AI Консьерж
      </button>
      <GhostToggle
        checked={isCatalog}
        onCheckedChange={switchTo}
        aria-label="Переключить экран: AI Консьерж или Каталог Островка"
      />
      <button
        type="button"
        onClick={() => switchTo(true)}
        aria-current={isCatalog ? "page" : undefined}
        className={labelClass(isCatalog)}
      >
        Каталог Островка
      </button>
    </nav>
  );
}
