"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui";
import { Search, ChevronLeft, ChevronRight, Eye, RefreshCw, Star } from "lucide-react";

interface HotelItem {
  id: string;
  name: string;
  city: string;
  stars: number;
  price_from: number;
  rating: number;
  address: string;
}

export const StudioDataBrowser: React.FC = () => {
  const [items, setItems] = useState<HotelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState("memory");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Record<string, unknown> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const limit = 15;

  const fetchHotels = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      });
      if (search.trim()) params.set("search", search.trim());
      if (city.trim()) params.set("city", city.trim());

      const res = await fetch(`/api/studio/hotels?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setSource(data.source || "memory");
      }
    } catch {
      // Игнорируем сетевые сбои
    } finally {
      setLoading(false);
    }
  }, [offset, search, city]);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels]);

  const viewDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/studio/hotels/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedHotel(data);
        setModalOpen(true);
      }
    } catch {
      // Игнорируем
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchHotels();
  };

  return (
    <div className="space-y-4">
      {/* Панель фильтров */}
      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию отеля..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Input
          placeholder="Город (напр. Сочи)..."
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-48 h-9 text-xs"
        />

        <Button type="submit" size="sm" variant="secondary" className="h-9 px-4 text-xs font-medium">
          Применить
        </Button>

        <Button
          type="button"
          onClick={() => {
            setSearch("");
            setCity("");
            setOffset(0);
          }}
          size="sm"
          variant="ghost"
          className="h-9 px-3 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Сброс
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            Источник: {source === "postgresql" ? "PostgreSQL (Cloud)" : "In-Memory Dataset"}
          </Badge>
          <Badge variant="secondary" className="text-xs font-mono">
            Всего: {total.toLocaleString("ru-RU")}
          </Badge>
        </div>
      </form>

      {/* Таблица данных */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24 font-mono text-xs">ID</TableHead>
              <TableHead className="text-xs">Название отеля</TableHead>
              <TableHead className="text-xs">Город</TableHead>
              <TableHead className="w-20 text-xs">Звезды</TableHead>
              <TableHead className="w-24 text-xs">Рейтинг</TableHead>
              <TableHead className="w-32 text-xs">Цена от</TableHead>
              <TableHead className="text-xs">Адрес</TableHead>
              <TableHead className="w-24 text-right text-xs">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-28 text-center text-xs text-muted-foreground">
                  Загрузка данных из хранилища...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-28 text-center text-xs text-muted-foreground">
                  Записи не найдены по заданным критериям
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                    {item.id}
                  </TableCell>
                  <TableCell className="font-medium text-xs text-foreground">
                    {item.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.city}</TableCell>
                  <TableCell className="text-xs text-foreground">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Star className="h-3 w-3 fill-rating text-rating shrink-0" />
                      {item.stars}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-primary">
                    {item.rating > 0 ? item.rating.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-foreground">
                    {item.price_from.toLocaleString("ru-RU")} ₽
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {item.address}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewDetails(item.id)}
                      className="h-7 px-2 text-xs text-primary hover:text-primary"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Инфо
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Пагинация */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/10 text-xs">
          <span className="text-muted-foreground">
            Показаны {items.length > 0 ? offset + 1 : 0} – {Math.min(offset + limit, total)} из {total}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="h-8 px-2.5 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= total || loading}
              onClick={() => setOffset(offset + limit)}
              className="h-8 px-2.5 text-xs"
            >
              Вперед <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Диалог детального просмотра отеля */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {(selectedHotel?.name as string) || "Детали записи отеля"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ID: {String(selectedHotel?.id || "")} | Город: {String(selectedHotel?.city || "")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 rounded-lg bg-muted border border-border p-3 overflow-x-auto text-xs font-mono text-foreground">
            <pre>{JSON.stringify(selectedHotel, null, 2)}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
