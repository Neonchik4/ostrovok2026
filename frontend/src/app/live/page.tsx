"use client";

import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { Button } from "@/shared/ui";

const CITY_PRESETS = [
  { label: "Сочи", path: "hotel/russia/sochi/?guests=2" },
  { label: "Санкт-Петербург", path: "hotel/russia/saint_petersburg/?guests=2" },
  { label: "Москва", path: "hotel/russia/moscow/?guests=2" },
  { label: "Казань", path: "hotel/russia/kazan/?guests=2" },
];

export default function LivePage() {
  const [currentPath, setCurrentPath] = useState<string>("hotel/russia/sochi/?guests=2");
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleSelectCity = (path: string) => {
    setIsLoading(true);
    setCurrentPath(path);
    setIframeKey((prev) => prev + 1);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const proxyUrl = `/api/live/proxy?path=${encodeURIComponent(currentPath)}`;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Верхняя контрольная панель Live Mirror */}
      <header className="z-50 flex h-14 w-full shrink-0 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> К поиску
            </Button>
          </Link>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold leading-tight tracking-tight">
                Ostrovok Live Copilot
              </span>
              <span className="text-[10px] text-muted-foreground">
                Боевая витрина ostrovok.ru с инъекцией Muse-агента
              </span>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Pure Live
          </div>
        </div>

        {/* Быстрые пресеты для жюри */}
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 md:flex">
            {CITY_PRESETS.map((city) => (
              <Button
                key={city.path}
                variant={currentPath === city.path ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleSelectCity(city.path)}
                className="h-7 px-2.5 text-xs"
              >
                {city.label}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-7 w-7 p-0"
            title="Перезагрузить страницу"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
          </Button>

          <Link href="/studio">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
              Studio
            </Button>
          </Link>
        </div>
      </header>

      {/* Полноэкранный контейнер реального Островка */}
      <main className="relative flex-1 w-full bg-background">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">
              Подключение к боевому ostrovok.ru и инъекция Muse Copilot...
            </p>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={proxyUrl}
          title="Ostrovok Live Search"
          className="h-full w-full border-none"
          onLoad={() => setIsLoading(false)}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </main>
    </div>
  );
}
