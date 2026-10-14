"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui";
import { StudioErDiagram } from "@/widgets/StudioErDiagram";
import { StudioDataBrowser } from "@/widgets/StudioDataBrowser";
import { StudioEnrichment } from "@/widgets/StudioEnrichment";
import {
  Database,
  ArrowLeft,
  KeyRound,
  Network,
  Table2,
  Sparkles,
} from "lucide-react";

export default function StudioPage() {
  const [token, setToken] = useState<string>("");
  const [authOpen, setAuthOpen] = useState(false);
  const [inputToken, setInputToken] = useState("");
  const [schema, setSchema] = useState<{ tables: []; relations: [] }>({ tables: [], relations: [] });
  const [loading, setLoading] = useState(true);

  // Инициализация токена из localStorage, URL или автоподстановка в dev
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get("token");
    const savedToken = queryToken || localStorage.getItem("ostrovok_studio_token");

    if (savedToken) {
      setToken(savedToken);
      if (queryToken) localStorage.setItem("ostrovok_studio_token", queryToken);
    } else {
      // Проверяем статус режима разработки (автоматическая авторизация в dev/dev:dop)
      fetch("/api/studio/auth-status")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.auto_token) {
            setToken(data.auto_token);
            localStorage.setItem("ostrovok_studio_token", data.auto_token);
          } else {
            setAuthOpen(true);
          }
        })
        .catch(() => {
          setAuthOpen(true);
        });
    }
  }, []);

  const loadSchema = useCallback(async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/studio/schema", {
        headers: { "X-Studio-Token": authToken },
      });
      if (res.ok) {
        const data = await res.json();
        setSchema(data);
      } else if (res.status === 401) {
        setAuthOpen(true);
      }
    } catch {
      // Игнорируем
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadSchema(token);
    }
  }, [token, loadSchema]);

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputToken.trim()) {
      localStorage.setItem("ostrovok_studio_token", inputToken.trim());
      setToken(inputToken.trim());
      setAuthOpen(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col overflow-y-auto">
      {/* Шапка студии */}
      <header className="border-b border-border bg-card/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-1.5" /> К поиску
              </Button>
            </Link>

            <div className="h-5 w-px bg-border" />

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground tracking-tight">
                  Database & AI Studio
                </h1>
                <p className="text-[10px] text-muted-foreground font-mono">
                  PostgreSQL + pgvector(768)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInputToken(token || "");
                setAuthOpen(true);
              }}
              className="h-8 text-xs px-3 border-border hover:border-primary/50"
            >
              <KeyRound className="h-3.5 w-3.5 mr-1.5 text-primary" />
              <span>Ключ доступа</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-xs text-muted-foreground">
            Загрузка структуры базы данных...
          </div>
        ) : (
          <Tabs defaultValue="schema" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="schema" className="text-xs">
                <Network className="h-3.5 w-3.5 mr-1.5" /> ER-схема связей
              </TabsTrigger>
              <TabsTrigger value="data" className="text-xs">
                <Table2 className="h-3.5 w-3.5 mr-1.5" /> Таблицы данных
              </TabsTrigger>
              <TabsTrigger value="enrichment" className="text-xs">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Обогащение данных
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schema">
              <StudioErDiagram schema={schema} />
            </TabsContent>

            <TabsContent value="data">
              <StudioDataBrowser token={token} />
            </TabsContent>

            <TabsContent value="enrichment">
              <StudioEnrichment token={token} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Диалог авторизации командного токена */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> Авторизация в Database Studio
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Введите командный токен доступа (STUDIO_TEAM_TOKEN). Токен сохранен в Doppler и доступен всей команде.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveToken} className="space-y-4 pt-2">
            <Input
              type="password"
              placeholder="ostrovok_studio_..."
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              className="text-xs font-mono h-9"
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <Button type="submit" size="sm" className="text-xs font-semibold px-4 h-8">
                Подтвердить вход
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
