"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
} from "@/shared/ui";
import { StudioErDiagram } from "@/widgets/StudioErDiagram";
import { StudioDataBrowser } from "@/widgets/StudioDataBrowser";
import {
  Database,
  ArrowLeft,
  Network,
  Table2,
} from "lucide-react";

export default function StudioPage() {
  const [schema, setSchema] = useState<{ tables: []; relations: [] }>({ tables: [], relations: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadSchema = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/studio/schema");
        if (res.ok && active) {
          const data = await res.json();
          setSchema(data);
        }
      } catch {
        // Игнорируем сетевые сбои
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSchema();
    return () => {
      active = false;
    };
  }, []);

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
                  Database Studio
                </h1>
                <p className="text-[10px] text-muted-foreground font-mono">
                  PostgreSQL + pgvector(768)
                </p>
              </div>
            </div>
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
            </TabsList>

            <TabsContent value="schema">
              <StudioErDiagram schema={schema} />
            </TabsContent>

            <TabsContent value="data">
              <StudioDataBrowser />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
