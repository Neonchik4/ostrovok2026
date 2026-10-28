import os
import time
from datetime import UTC, datetime

from ..schemas.chat import (
    ChatStreamRequest,
    ExtractedSlots,
    HotelCardWidget,
    SearchTelemetry,
    TransportSummary,
)


class WorkflowRunLogger:
    """
    Ведет подробный аудит-лог каждого запуска AI-агента.
    Сохраняет полный контекст последнего запроса в outputs/last_run.log
    и краткую историю в outputs/runs_history.log.
    """

    def __init__(self, req: ChatStreamRequest):
        self.start_time = time.time()
        self.timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
        self.req = req
        self.slots: ExtractedSlots | None = None
        self.transport: TransportSummary | None = None
        self.single_ticket_price: int = 0
        self.total_ticket_price: int = 0
        self.tickets_count: int = max(1, req.guests or 1)
        self.transport_label: str = ""
        self.telemetry: SearchTelemetry | None = None
        self.hotels: list[HotelCardWidget] = []
        self.thoughts: list[tuple[str, str]] = []
        self.response_tokens: list[str] = []
        self.chips: list[str] = []
        self.status: str = "in_progress"
        self.error: str | None = None

    def log_thought(self, step: str, text: str) -> None:
        self.thoughts.append((step, text))

    def log_slots(self, slots: ExtractedSlots) -> None:
        self.slots = slots
        if slots.guests_count:
            self.tickets_count = max(1, slots.guests_count)

    def log_transport(
        self,
        transport: TransportSummary | None,
        single_price: int,
        total_price: int,
        count: int,
        label: str,
    ) -> None:
        self.transport = transport
        self.single_ticket_price = single_price
        self.total_ticket_price = total_price
        self.tickets_count = count
        self.transport_label = label

    def log_telemetry(self, telemetry: SearchTelemetry) -> None:
        self.telemetry = telemetry

    def log_hotels(self, hotels: list[HotelCardWidget]) -> None:
        self.hotels = list(hotels)

    def log_token(self, chunk: str) -> None:
        self.response_tokens.append(chunk)

    def log_chips(self, chips: list[str]) -> None:
        self.chips = list(chips)

    def finish(self, status: str = "ok", error: str | None = None) -> None:
        self.status = status
        self.error = error
        self._write_logs()

    def _format_last_run(self) -> str:
        duration = round(time.time() - self.start_time, 2)
        lines = [
            "=" * 80,
            "ОСТРОВОК AI-АГЕНТ — ЛОГ ПОСЛЕДНЕГО ЗАПУСКА (LAST RUN)",
            f"Время запуска: {self.timestamp}",
            f"Длительность:  {duration} сек",
            f"Conversation:  {self.req.conversation_id or 'default_session'}",
            "=" * 80,
            "",
            "[1. ВХОДЯЩИЙ ЗАПРОС]",
            f"Сообщение: {self.req.message}",
            f"Чипс:      {self.req.disambiguation_selection or 'нет'}",
            f"Параметры: гости={self.req.guests}, ночи={self.req.nights}, питомцы={self.req.pets}",
            "",
        ]

        if self.slots:
            s = self.slots
            if s.city:
                dest_str = s.city
            elif s.candidate_cities:
                dest_str = f"не указан (кандидаты: {', '.join(s.candidate_cities)})"
            else:
                dest_str = "не указан"

            lines.extend([
                "[2. ИЗВЛЕЧЕННЫЕ СЛОТЫ]",
                f"Город назначения: {dest_str}",
                f"Город выезда:     {s.origin_city or 'не указан (по умолчанию Москва)'}",
                f"Гости:            {s.guests_count} чел.",
                f"Ночи:             {s.nights}",
                f"Транспорт:        {s.transport_preference or 'любой'}",
                f"Даты:             {s.depart_date or 'не указаны'}",
                f"Бюджет:           {s.max_price_per_night_rub or 'не ограничен'} ₽/ночь",
                f"Логистика отеля:  заезд={s.arrival_time or 'стандарт с 14:00'}, выезд={s.departure_time or 'стандарт до 12:00'}",
                f"Удобства:         питомцы={s.pet_friendly}, бассейн={s.heated_pool}, спа={s.spa}, завтрак={s.breakfast_included}",
                "",
            ])

        if self.transport or self.total_ticket_price > 0:
            lines.append("[3. ТРАНСПОРТ И ЛОГИСТИКА]")
            if self.transport:
                t = self.transport
                lines.extend([
                    f"Маршрут:          {t.origin_city} -> {t.destination_city}",
                    f"Выбранный режим:  {t.preferred_mode}",
                ])
                if t.recommended_train:
                    lines.append(f"Поезд:            {t.recommended_train.train_number} (прибытие {t.recommended_train.arrival_at or '08:15'})")
                if t.recommended_flight:
                    lines.append(f"Рейс:             {t.recommended_flight.airline} (прилет {t.recommended_flight.arrival_at or '13:45'})")
            if self.total_ticket_price > 0:
                lines.extend([
                    f"Цена за 1 билет:  {self.single_ticket_price:,} ₽".replace(",", " "),
                    f"Кол-во билетов:   {self.tickets_count} шт. (по числу гостей)",
                    f"Итого за билеты:  {self.total_ticket_price:,} ₽".replace(",", " "),
                ])
            lines.append("")

        if self.telemetry:
            telem = self.telemetry
            lines.extend([
                "[4. ПОИСК ОТЕЛЕЙ]",
                f"Движок:           {telem.engine}",
                f"В регионе:        {telem.total_in_region} отелей",
                f"Совпали строго:   {telem.scalar_matched} отелей",
                f"Relaxed поиск:    {telem.is_relaxed}",
                f"Отобрано в выдачу:{len(self.hotels)} отелей",
                "",
            ])

        if self.hotels:
            lines.append("[5. ТОП ОТЕЛИ И РАСЧЕТ ЧЕКА ПОД КЛЮЧ]")
            for i, h in enumerate(self.hotels[:3], 1):
                r = h.receipt
                rec_str = (
                    f"отель {r.total_rub:,} ₽ + трансфер {r.transfer_cost_rub:,} ₽ + транспорт {r.transport_ticket_rub:,} ₽ = {r.total_with_transport_rub:,} ₽"
                    if r else "чек не рассчитан"
                ).replace(",", " ")
                lines.extend([
                    f"{i}. «{h.name}» ({h.city}) — Match {h.match_score_pct}%, от {h.min_price_per_night_rub:,} ₽/ночь".replace(",", " "),
                    f"   Номер: {h.suitable_room.name if h.suitable_room else 'Стандарт'}",
                    f"   Чек:   {rec_str}",
                ])
            lines.append("")

        if self.thoughts:
            lines.append("[6. ХОД МЫСЛЕЙ (THOUGHT STREAM)]")
            for step, text in self.thoughts:
                lines.append(f"- [{step}]: {text}")
            lines.append("")

        resp_text = "".join(self.response_tokens).strip()
        lines.extend([
            "[7. ОТВЕТ АССИСТЕНТА]",
            resp_text or "(ответ пуст)",
            "",
            "[8. ПОДСКАЗКИ / ЧИПСЫ]",
            ", ".join(self.chips) if self.chips else "нет",
            "",
            "[9. СТАТУС ВЫПОЛНЕНИЯ]",
            f"Статус: {self.status.upper()}",
        ])
        if self.error:
            lines.append(f"Ошибка: {self.error}")

        lines.extend(["=" * 80, ""])
        return "\n".join(lines)

    def _write_logs(self) -> None:
        try:
            log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "outputs"))
            if not os.access(log_dir, os.W_OK) and not os.access(os.path.dirname(log_dir), os.W_OK):
                log_dir = "/tmp"
            os.makedirs(log_dir, exist_ok=True)

            last_run_path = os.path.join(log_dir, "last_run.log")
            content = self._format_last_run()
            with open(last_run_path, "w", encoding="utf-8") as f:
                f.write(content)

            history_path = os.path.join(log_dir, "runs_history.log")
            duration = round(time.time() - self.start_time, 2)
            summary = (
                f"[{self.timestamp}] [{self.status.upper()}] {duration}s | "
                f"Query: \"{self.req.message}\" | "
                f"Guests: {self.tickets_count} | "
                f"City: {self.slots.city if self.slots else 'None'} | "
                f"Hotels: {len(self.hotels)} | "
                f"Tickets: {self.total_ticket_price} RUB\n"
            )
            with open(history_path, "a", encoding="utf-8") as f:
                f.write(summary)
        except Exception as e:
            # Логирование никогда не должно нарушать работу основного сервиса
            print(f"[WorkflowRunLogger Warning] Не удалось записать лог: {e}")
