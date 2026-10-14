"use client";

import { Database, KeyRound, Link2, Search,Table2 } from "lucide-react";
import React, { useMemo,useState } from "react";

import { Badge, Card, Input } from "@/shared/ui";

interface ColumnDef {
  name: string;
  type: string;
  pk: boolean;
  fk: string | null;
}

interface TableDef {
  name: string;
  label: string;
  columns: ColumnDef[];
}

interface RelationDef {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  label: string;
}

interface SchemaData {
  tables: TableDef[];
  relations: RelationDef[];
}

interface Props {
  schema: SchemaData;
}

export const StudioErDiagram: React.FC<Props> = ({ schema }) => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");

  const filteredTables = useMemo(() => {
    if (!filterText.trim()) return schema.tables;
    const q = filterText.toLowerCase();
    return schema.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q))
    );
  }, [schema.tables, filterText]);

  // Определение связанных таблиц для подсветки
  const relatedTables = new Set<string>();
  if (selectedTable) {
    relatedTables.add(selectedTable);
    schema.relations.forEach((rel) => {
      if (rel.from_table === selectedTable) relatedTables.add(rel.to_table);
      if (rel.to_table === selectedTable) relatedTables.add(rel.from_table);
    });
  }

  return (
    <div className="space-y-6">
      {/* Шапка диаграммы с поиском и системной легендой */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Реляционная схема базы данных
            </h3>
            <p className="text-xs text-muted-foreground">
              Таблиц: {schema.tables.length} · Связей: {schema.relations.length} · Индекс: vector(384) HNSW
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Поиск по таблицам и полям..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Сетка таблиц */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTables.map((table) => {
          const isSelected = selectedTable === table.name;
          const isRelated = relatedTables.has(table.name);

          return (
            <Card
              key={table.name}
              onClick={() => setSelectedTable(isSelected ? null : table.name)}
              className={`cursor-pointer transition-all duration-200 border ${
                isSelected
                  ? "border-primary ring-2 ring-primary/20 bg-card shadow-sm"
                  : isRelated
                  ? "border-primary/60 bg-card"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              {/* Заголовок таблицы */}
              <div className="flex items-center justify-between border-b border-border p-3 bg-muted/40">
                <div className="flex items-center gap-2 min-w-0">
                  <Table2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm text-foreground truncate">
                    {table.name}
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0 font-mono text-secondary-foreground">
                  {table.columns.length} col
                </Badge>
              </div>

              {/* Список колонок */}
              <div className="p-3 divide-y divide-border/40 text-xs">
                {table.columns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center justify-between py-1.5 gap-2"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {col.pk && (
                        <span title="Primary Key">
                          <KeyRound className="h-3 w-3 text-primary shrink-0" />
                        </span>
                      )}
                      {col.fk && (
                        <span title={`Foreign Key -> ${col.fk}`}>
                          <Link2 className="h-3 w-3 text-secondary-foreground shrink-0" />
                        </span>
                      )}
                      <span
                        className={`truncate font-mono ${
                          col.pk
                            ? "font-semibold text-foreground"
                            : col.fk
                            ? "font-medium text-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {col.name}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {col.type}
                    </span>
                  </div>
                ))}
              </div>

              {/* Описание таблицы */}
              <div className="border-t border-border/50 px-3 py-2 bg-muted/20 text-[11px] text-muted-foreground">
                {table.label}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Список связей */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Реестр связей (Foreign Keys Relations Map)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {schema.relations.map((rel, idx) => {
            const isHighlighted =
              selectedTable &&
              (rel.from_table === selectedTable || rel.to_table === selectedTable);

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                  isHighlighted
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                    : "border-border bg-muted/30 text-foreground"
                }`}
              >
                <span className="font-mono">{rel.from_table}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isHighlighted
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {rel.label}
                </span>
                <span className="font-mono">{rel.to_table}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
