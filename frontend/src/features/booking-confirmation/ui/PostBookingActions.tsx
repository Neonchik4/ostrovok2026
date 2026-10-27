"use client";

import { Car, Check, Clock, Dog } from "lucide-react";
import React from "react";

import { Badge, Button } from "@/shared/ui";

export interface PostBookingServicesState {
  earlyCheckin: boolean;
  pet: boolean;
  transfer: boolean;
}

interface PostBookingActionsProps {
  state: PostBookingServicesState;
  onToggle: (service: keyof PostBookingServicesState) => void;
}

const ACTION_CONFIG = [
  {
    key: "earlyCheckin" as const,
    title: "Ранний заезд / поздний выезд",
    subtitle: "Заезд с 10:00 или выезд до 16:00 (по согласованию с отелем)",
    icon: Clock,
    buttonIdleText: "Запросить",
    buttonActiveText: "Запрос отправлен",
    feedbackText: "Запрос на ранний заезд или поздний выезд передан администратору отеля.",
    testId: "post-booking-early-checkin",
    feedbackTestId: "early-checkin-feedback",
  },
  {
    key: "pet" as const,
    title: "Проживание с питомцем",
    subtitle: "Согласование размещения домашнего животного в номере",
    icon: Dog,
    buttonIdleText: "Добавить питомца",
    buttonActiveText: "Питомец добавлен",
    feedbackText: "Проживание с домашним животным добавлено в заявку на бронирование.",
    testId: "post-booking-pet",
    feedbackTestId: "pet-feedback",
  },
  {
    key: "transfer" as const,
    title: "Трансфер в отель",
    subtitle: "Индивидуальная встреча в аэропорту или на вокзале с табличкой",
    icon: Car,
    buttonIdleText: "Заказать трансфер",
    buttonActiveText: "Трансфер заказан",
    feedbackText: "Заявка на встречу принята. Служба трансфера свяжется перед заездом.",
    testId: "post-booking-transfer",
    feedbackTestId: "transfer-feedback",
  },
] as const;

export function PostBookingActions({ state, onToggle }: PostBookingActionsProps) {
  const activeCount = Object.values(state).filter(Boolean).length;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Сервисы к поездке
        </span>
        {activeCount > 0 && (
          <Badge variant="accent" className="text-[11px] font-semibold">
            Выбрано услуг: {activeCount}
          </Badge>
        )}
      </div>

      <div className="space-y-2.5">
        {ACTION_CONFIG.map((action) => {
          const Icon = action.icon;
          const isActive = state[action.key];

          return (
            <div
              key={action.key}
              className={`rounded-lg border p-3 transition-colors ${
                isActive
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-background/50 hover:border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 rounded-md p-1.5 ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-card text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{action.title}</div>
                    <div className="text-xs text-muted-foreground">{action.subtitle}</div>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => onToggle(action.key)}
                  data-testid={action.testId}
                  className={`h-8 shrink-0 text-xs font-semibold ${
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-border text-foreground hover:border-primary/40 hover:bg-primary/10"
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      {action.buttonActiveText}
                    </>
                  ) : (
                    action.buttonIdleText
                  )}
                </Button>
              </div>

              {isActive && (
                <div
                  data-testid={action.feedbackTestId}
                  className="mt-2.5 rounded-md border border-primary/30 bg-primary/15 px-2.5 py-1.5 text-xs text-primary"
                >
                  {action.feedbackText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
