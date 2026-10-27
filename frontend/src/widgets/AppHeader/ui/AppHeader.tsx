import React from "react";

import { OfflineModeBadge } from "@/features/offline-mode";
import { ScreenSwitch } from "@/features/screen-switch";
import { Logo } from "@/shared/ui";

import { StudioLink } from "./StudioLink";

interface AppHeaderProps {
  /** Статус текущего экрана рядом с логотипом. */
  title: string;
  /** Сообщение Zero-Config Offline Mode из SSE-события mode (Issue #46). */
  offlineNotice?: string | null;
}

/** Единая шапка экранов фиксированной высоты 56px — без сдвига контента при смене роута. */
export function AppHeader({ title, offlineNotice }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Logo variant="mark" size={32} className="rounded-lg shadow-md" />
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <StudioLink />
        <OfflineModeBadge message={offlineNotice} />
      </div>
      <ScreenSwitch />
    </header>
  );
}
