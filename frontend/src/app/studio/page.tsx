"use client";

import { ArrowLeft, Database, Network, Table2 } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui";
import { StudioDataBrowser } from "@/widgets/StudioDataBrowser";
import { StudioErDiagram } from "@/widgets/StudioErDiagram";

export default function StudioPage() {
  const [schema, setSchema] = useState<{ tables: []; relations: [] }>({
    tables: [],
    relations: [],
  });
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

    void loadSchema();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col overflow-y-auto bg-background text-foreground">
      {/* Шапка студии */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> К поиску
              </Button>
            </Link>

            <div className="h-5 w-px bg-border" />

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-foreground">
                  Database Studio
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
            Загрузка структуры базы данных...
          </div>
        ) : (
          <Tabs defaultValue="schema" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="schema" className="text-xs">
                <Network className="mr-1.5 h-3.5 w-3.5" /> ER-схема связей
              </TabsTrigger>
              <TabsTrigger value="data" className="text-xs">
                <Table2 className="mr-1.5 h-3.5 w-3.5" /> Таблицы данных
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
