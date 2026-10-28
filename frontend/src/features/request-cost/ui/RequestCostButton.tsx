"use client";

import { Coins } from "lucide-react";
import React from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui";

import { RequestCostReport } from "./RequestCostReport";

/** Кнопка в шапке рядом со Studio: окно со стоимостью реальных запросов к LLM в сессии вкладки. */
export function RequestCostButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Coins className="mr-1.5 h-3.5 w-3.5 text-primary" /> Request Cost
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Стоимость запросов к LLM</DialogTitle>
          <DialogDescription>
            Реальные вызовы Gemini API в этой вкладке: чат на главной и Ghost-агент в каталоге.
          </DialogDescription>
        </DialogHeader>
        <RequestCostReport />
      </DialogContent>
    </Dialog>
  );
}
