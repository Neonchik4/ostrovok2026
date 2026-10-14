"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button, Input, Card, Badge } from "@/shared/ui";
import {
  Sparkles,
  Bot,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Save,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";

interface Proposal {
  id: string;
  hotel_id?: string;
  hotel_name?: string;
  status: "pending" | "approved" | "rejected" | "rolled_back";
  diff_patch: Record<string, unknown>;
  rationale?: string;
  source_url?: string;
  created_at?: string;
}

interface Props {
  token: string;
}

export const StudioEnrichment: React.FC<Props> = ({ token }) => {
  const [city, setCity] = useState("Сочи");
  const [prompt, setPrompt] = useState("Найти спа-отели и актуализировать подогреваемые бассейны");
  const [running, setRunning] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/proposals", {
        headers: { "X-Studio-Token": token },
      });
      if (res.ok) {
        const data = await res.json();
        setProposals(data || []);
      }
    } catch {
      // Игнорируем
    }
  }, [token]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleStartTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (running) return;

    setRunning(true);
    setStreamLogs([]);

    try {
      const resp = await fetch("/api/studio/enrich/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Studio-Token": token,
        },
        body: JSON.stringify({ city, prompt }),
      });

      if (!resp.ok) {
        setStreamLogs((prev) => [...prev, "Ошибка запуска агента: статус " + resp.status]);
        setRunning(false);
        return;
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value);
        const lines = textChunk.split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.replace("data: ", ""));
              if (eventData.text) {
                setStreamLogs((prev) => [...prev, eventData.text]);
              }
            } catch {
              // Игнорируем ошибки парсинга чанка
            }
          }
        }
      }
    } catch (err) {
      setStreamLogs((prev) => [...prev, "Сбой соединения с агентом: " + String(err)]);
    } finally {
      setRunning(false);
      fetchProposals();
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/studio/proposals/${id}/approve`, {
        method: "POST",
        headers: { "X-Studio-Token": token },
      });
      if (res.ok) fetchProposals();
    } catch {
      // Игнорируем
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/studio/proposals/${id}/reject`, {
        method: "POST",
        headers: { "X-Studio-Token": token },
      });
      if (res.ok) fetchProposals();
    } catch {
      // Игнорируем
    }
  };

  const handleRollback = async (id: string) => {
    try {
      const res = await fetch(`/api/studio/proposals/${id}/rollback`, {
        method: "POST",
        headers: { "X-Studio-Token": token },
      });
      if (res.ok) fetchProposals();
    } catch {
      // Игнорируем
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await fetch("/api/studio/backup/create", {
        method: "POST",
        headers: { "X-Studio-Token": token },
      });
      if (res.ok) {
        const data = await res.json();
        setBackupMsg(`Снимок базы сохранен: ${data.file}`);
        setTimeout(() => setBackupMsg(null), 5000);
      }
    } catch {
      // Игнорируем
    }
  };

  const filteredProposals = proposals.filter((p) => {
    if (statusFilter === "all") return true;
    return p.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Панель запуска задачи и создания бэкапа */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 border-border bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Запуск автономного агента обогащения (Gemini 2.5 + Cloudflare)
            </h3>
          </div>

          <form onSubmit={handleStartTask} className="space-y-3">
            <div className="flex gap-3">
              <Input
                placeholder="Город (напр. Сочи)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-40 text-xs h-9"
              />
              <Input
                placeholder="Цель: заполнить правила питомцев, спа, бассейны..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 text-xs h-9"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">
                Агент находит недостающие данные, формирует diff и ждет подтверждения.
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={running}
                className="h-8 px-4 text-xs font-semibold"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {running ? "Агент работает..." : "Запустить обогащение"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Панель снимков базы */}
        <Card className="p-5 border-border bg-card flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Save className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold text-foreground">Защита данных и бэкапы</h4>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Перед каждым применением изменений создается снимок отеля. Вы можете сделать полный снимок базы в любой момент.
            </p>
          </div>

          <div className="pt-3">
            {backupMsg && (
              <div className="mb-2 p-2 rounded bg-primary/10 border border-primary/30 text-[10px] text-primary font-mono truncate">
                {backupMsg}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateBackup}
              className="w-full text-xs h-8 border-border"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" /> Создать снимок состояния
            </Button>
          </div>
        </Card>
      </div>

      {/* Лог мыслей агента в реальном времени */}
      {streamLogs.length > 0 && (
        <Card className="p-4 border-primary/40 bg-card/80">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <h4 className="text-xs font-semibold text-foreground">Стрим действий агента (Live Thoughts)</h4>
          </div>
          <div className="space-y-1 font-mono text-xs max-h-48 overflow-y-auto">
            {streamLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-muted-foreground">
                <ArrowRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                <span>{log}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Очередь предложений изменений */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Очередь модерации изменений</h3>
            <Badge variant="secondary" className="text-xs font-mono">
              {filteredProposals.length}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            {["all", "pending", "approved", "rejected"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "ghost"}
                onClick={() => setStatusFilter(s)}
                className="h-7 px-2.5 text-xs capitalize"
              >
                {s === "all" ? "Все" : s === "pending" ? "Ожидают" : s === "approved" ? "Одобрено" : "Отклонено"}
              </Button>
            ))}
          </div>
        </div>

        {filteredProposals.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground border-border bg-card">
            Нет предложений в выбранном статусе. Запустите агента обогащения выше.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProposals.map((p) => (
              <Card key={p.id} className="p-4 border-border bg-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-xs text-foreground truncate">
                      {p.hotel_name || p.hotel_id}
                    </span>
                    <Badge
                      variant={
                        p.status === "approved"
                          ? "default"
                          : p.status === "pending"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-[10px] font-mono shrink-0"
                    >
                      {p.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 leading-snug">
                    {p.rationale || "Предложение обновлений атрибутов"}
                  </p>

                  {/* Визуальный Diff */}
                  <div className="rounded-lg bg-muted/60 border border-border p-2.5 mb-3 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                      Предлагаемые изменения (Diff Patch):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(p.diff_patch || {}).map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 rounded bg-secondary border border-border px-2 py-0.5 text-[11px] font-mono text-secondary-foreground"
                        >
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="font-semibold text-foreground">{String(v)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {p.created_at ? new Date(p.created_at).toLocaleTimeString("ru-RU") : "Недавно"}
                  </span>

                  <div className="flex items-center gap-2">
                    {p.status === "pending" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(p.id)}
                          className="h-7 px-2.5 text-xs text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Отклонить
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(p.id)}
                          className="h-7 px-3 text-xs font-semibold"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Одобрить в БД
                        </Button>
                      </>
                    )}

                    {p.status === "approved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRollback(p.id)}
                        className="h-7 px-2.5 text-xs text-warning border-warning/40 hover:bg-warning-bg/40"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Откатить изменение
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
