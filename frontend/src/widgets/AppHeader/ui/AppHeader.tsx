import React from "react";

import { OfflineModeBadge } from "@/features/offline-mode";
import { RequestCostButton } from "@/features/request-cost";
import { ScreenSwitch } from "@/features/screen-switch";
import { Logo } from "@/shared/ui";

import { StudioLink } from "./StudioLink";

/** Заголовки всех экранов с шапкой: под самый длинный резервируется ширина. */
const SCREEN_TITLES = ["Агент Островка", "Каталог Островка"];

interface AppHeaderProps {
  /** Статус текущего экрана рядом с логотипом. */
  title: string;
  /** Сообщение Zero-Config Offline Mode из SSE-события mode (Issue #46). */
  offlineNotice?: string | null;
  /** Дополнительное действие в шапке (например, кнопка Поделиться поездки). */
  action?: React.ReactNode;
}

/** Единая шапка экранов фиксированной высоты 56px — без сдвига контента при смене роута. */
export function AppHeader({ title, offlineNotice, action }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Logo variant="mark" size={32} className="rounded-lg shadow-md" />
        {/* Все заголовки в одной ячейке grid: соседние кнопки не прыгают при смене экрана */}
        <div className="grid">
          {SCREEN_TITLES.map((screenTitle) => (
            <span
              key={screenTitle}
              aria-hidden="true"
              data-reserve-title={screenTitle}
              className="invisible col-start-1 row-start-1 whitespace-nowrap text-base font-bold after:content-[attr(data-reserve-title)]"
            />
          ))}
          <h2 className="col-start-1 row-start-1 whitespace-nowrap text-base font-bold text-foreground">
            {title}
          </h2>
        </div>
        <StudioLink />
        <RequestCostButton />
        <OfflineModeBadge message={offlineNotice} />
      </div>
      <div className="flex items-center gap-2.5">
        {action}
        <ScreenSwitch />
      </div>
    </header>
  );
}
