import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

from ..schemas.chat import ChatStreamRequest, ExtractedSlots
from ..services.hotel_search_adapter import search_hotels_with_telemetry
from ..services.llm_cascade import (
    build_deterministic_reasoning,
    extract_slots_cascade,
    generate_concierge_response_stream,
)
from ..services.offline_mode import OFFLINE_MODE_MESSAGE, is_offline_mode, note_offline_once
from ..services.route_extractor import default_chips
from ..services.run_logger import WorkflowRunLogger
from ..services.session_memory import merge_slots, session_memory
from ..services.transport_service import search_transport_options


async def run_agent_workflow(req: ChatStreamRequest) -> AsyncGenerator[str, None]:
    """
    Потоковый генератор Server-Sent Events (SSE).
    Генерирует детерминированную телеметрию пайплайна:
    - event: thought (reasoning -> filtering -> hybrid_search -> results -> receipt_calculation)
    - event: token
    - event: widget
    - event: done
    """
    conv_id = req.conversation_id or "default_session"
    prev_slots = session_memory.get_slots(conv_id)

    message = req.message.strip()
    if req.disambiguation_selection:
        sel = req.disambiguation_selection.strip()
        if not message or message.lower() == sel.lower():
            message = sel
        elif sel.lower() not in message.lower():
            message = f"{message}. Уточнение: {sel}"

    logger = WorkflowRunLogger(req)

    try:
        # 1. Мгновенная индикация начала обработки (< 50 мс для исключения зависаний)
        init_thought = "Оцениваю параметры запроса и формирую критерии поиска..."
        logger.log_thought("reasoning", init_thought)
        yield _format_sse("thought", {"step": "reasoning", "text": init_thought})

        # 0. Zero-Config Offline Mode: статусная плашка автономного режима (Issue #46).
        # Отдаётся сразу после init-thought, чтобы не нарушать контракт
        # «первое событие стрима — thought (reasoning)».
        if is_offline_mode():
            note_offline_once()
            logger.log_thought("mode", OFFLINE_MODE_MESSAGE)
            yield _format_sse("mode", {"offline": True, "message": OFFLINE_MODE_MESSAGE})

        # Извлечение интентов и слотов через каскад (Gemini 2.5 Flash / Flash Lite -> локальный экстрактор)
        new_slots: ExtractedSlots = await extract_slots_cascade(message)
        if req.nights and req.nights != 2:
            new_slots.nights = req.nights
        if req.guests and req.guests != 2:
            new_slots.guests_count = req.guests
        if req.pets and req.pets > 0:
            new_slots.pet_friendly = True

        slots: ExtractedSlots = merge_slots(prev_slots, new_slots)
        session_memory.save_slots(conv_id, slots)
        logger.log_slots(slots)

        city_label = slots.city or slots.thematic_title or "выбранном регионе"

        # Детерминированное рассуждение на базе реального запроса и извлеченных слотов
        reasoning_text = build_deterministic_reasoning(message, slots)
        logger.log_thought("reasoning", reasoning_text)
        yield _format_sse("thought", {"step": "reasoning", "text": reasoning_text})
        await asyncio.sleep(0.2)

        # Поиск транспорта и билетов (Travelpayouts) + состыковка времени
        default_fallback_city = slots.candidate_cities[0] if slots.candidate_cities else "Сочи"
        destination_city = slots.city or default_fallback_city
        if slots.origin_city:
            origin_city = slots.origin_city
        else:
            origin_city = "Санкт-Петербург" if destination_city == "Москва" else "Москва"

        if origin_city == destination_city:
            origin_city = "Санкт-Петербург" if destination_city == "Москва" else "Москва"

        transport = await search_transport_options(
            origin_city,
            destination_city,
            depart_date=slots.depart_date,
            preferred_mode=slots.transport_preference or "both",
        )
        if not slots.arrival_time and transport.arrival_time:
            slots.arrival_time = transport.arrival_time

        guests_cnt = max(1, slots.guests_count or 1)
        is_train_pref = slots.transport_preference == "train"
        if is_train_pref and transport.recommended_train:
            tr = transport.recommended_train
            single_price = tr.price_from_rub
            total_price = single_price * guests_cnt
            arr_t = tr.arrival_at[11:16] if tr.arrival_at and len(tr.arrival_at) >= 16 else "08:15"
            route_label = f"{transport.origin_city} -> {transport.destination_city}" if slots.origin_city else f"маршрут в {transport.destination_city} (на примере {transport.origin_city})"
            price_text = f"{guests_cnt} билета по {single_price:,} ₽ ({total_price:,} ₽)" if guests_cnt > 1 else f"от {single_price:,} ₽"
            tr_thought = f"Транспорт {route_label}: поезд {tr.train_number} {price_text} (прибытие {arr_t}), сопоставляю с заселением в отель".replace(",", " ")
            logger.log_thought("transport_search", tr_thought)
            yield _format_sse("thought", {
                "step": "transport_search",
                "text": tr_thought,
            })
            await asyncio.sleep(0.15)
        elif transport.recommended_flight:
            fl = transport.recommended_flight
            single_price = fl.price_rub
            total_price = single_price * guests_cnt
            route_label = f"{transport.origin_city} -> {transport.destination_city}" if slots.origin_city else f"маршрут в {transport.destination_city} (на примере {transport.origin_city})"
            price_text = f"{guests_cnt} билета по {single_price:,} ₽ ({total_price:,} ₽)" if guests_cnt > 1 else f"от {single_price:,} ₽"
            fl_thought = f"Транспорт {route_label}: рейс {fl.airline} {price_text} (прилет в {transport.arrival_time or '13:45'}), сопоставляю с заселением в отель".replace(",", " ")
            logger.log_thought("transport_search", fl_thought)
            yield _format_sse("thought", {
                "step": "transport_search",
                "text": fl_thought,
            })
            await asyncio.sleep(0.15)

        if slots.arrival_time:
            logistics_thought = f"Логистика состыковки: время прибытия {slots.arrival_time}. Проверяю время заезда, наличие круглосуточной стойки и камер хранения..."
            logger.log_thought("logistics_validation", logistics_thought)
            yield _format_sse("thought", {
                "step": "logistics_validation",
                "text": logistics_thought,
            })
            await asyncio.sleep(0.15)

        # 2. Выполняем поиск отелей с получением реальной телеметрии базы
        hotels, telemetry = await search_hotels_with_telemetry(slots)

        # 3. Шаг рассуждения: Применение фильтров и скалярная статистика
        active_filters = []
        if slots.stars:
            active_filters.append(f"от {slots.stars}★")
        if slots.max_price_per_night_rub:
            active_filters.append(f"до {slots.max_price_per_night_rub:,} ₽/ночь".replace(",", " "))
        if slots.heated_pool:
            active_filters.append("теплый бассейн")
        if slots.spa:
            active_filters.append("СПА-комплекс")
        if slots.breakfast_included:
            active_filters.append("завтрак включён")
        if slots.free_cancellation:
            active_filters.append("свободная отмена")
        if slots.pet_friendly:
            active_filters.append("с питомцем")
        
        if active_filters:
            filters_text = (
                f"Скалярная фильтрация: проверено {telemetry.total_evaluated} отелей "
                f"({telemetry.total_in_region} в {city_label}) -> "
                f"{telemetry.scalar_matched} строго соответствуют критериям ({', '.join(active_filters)})"
            )
        else:
            filters_text = f"Каталог {city_label}: доступно {telemetry.total_in_region} отелей, ранжирую по рейтингу и отзывам"

        logger.log_telemetry(telemetry)
        logger.log_hotels(hotels)
        logger.log_thought("filtering", filters_text)
        yield _format_sse("thought", {"step": "filtering", "text": filters_text})
        await asyncio.sleep(0.2)

        # 4. Шаг: Векторный гибридный поиск
        hybrid_text = f"Векторный поиск ({telemetry.engine}): ранжирование кандидатов по косинусному сходству и отзывам гостей..."
        logger.log_thought("hybrid_search", hybrid_text)
        yield _format_sse("thought", {
            "step": "hybrid_search",
            "text": hybrid_text,
        })
        await asyncio.sleep(0.2)
        
        # 5. Итог поиска с прозрачной статистикой
        if hotels:
            top_score = telemetry.top_score_pct or hotels[0].match_score_pct
            min_cost = telemetry.min_price_rub or min(h.min_price_per_night_rub for h in hotels)
            if telemetry.is_relaxed:
                if slots.max_price_per_night_rub:
                    budget_note = f"В рамках бюджета до {slots.max_price_per_night_rub:,} ₽ отелей в {city_label} нет (минимальный тариф от {min_cost:,} ₽). "
                else:
                    budget_note = f"Строгих совпадений в {city_label} не нашлось (минимальный тариф от {min_cost:,} ₽). "
                res_text = f"{budget_note}Отобрал {len(hotels)} {_pluralize_hotels(len(hotels))} с наилучшим соотношением цены и качества".replace(",", " ")
            else:
                res_text = f"Найдено {len(hotels)} {_pluralize_hotels(len(hotels))}, лучший Match Score: {top_score}%, цены от {min_cost:,} ₽/ночь".replace(",", " ")
        else:
            res_text = f"Отели по строгому запросу не найдены в {city_label}, предлагаю скорректировать фильтры"

        logger.log_thought("results", res_text)
        yield _format_sse("thought", {
            "step": "results",
            "text": res_text,
        })
        await asyncio.sleep(0.2)

        # 6. Шаг рассуждения: Детерминированный расчет чека под ключ для всех отелей
        guests_cnt = max(1, slots.guests_count or 1)
        is_train = slots.transport_preference == "train"
        if is_train and transport and transport.recommended_train:
            single_price = transport.recommended_train.price_from_rub
            total_tickets = single_price * guests_cnt
            t_type = "train"
            t_name = transport.recommended_train.train_number
            t_label = (
                f"поезд {t_name} ({guests_cnt} чел. по {single_price:,} ₽ = {total_tickets:,} ₽)".replace(",", " ")
                if guests_cnt > 1
                else f"поезд {t_name} {total_tickets:,} ₽".replace(",", " ")
            )
        elif transport and transport.recommended_flight:
            single_price = transport.recommended_flight.price_rub
            total_tickets = single_price * guests_cnt
            t_type = "flight"
            t_name = transport.recommended_flight.airline
            t_label = (
                f"перелет {t_name} ({guests_cnt} чел. по {single_price:,} ₽ = {total_tickets:,} ₽)".replace(",", " ")
                if guests_cnt > 1
                else f"перелет {t_name} {total_tickets:,} ₽".replace(",", " ")
            )
        else:
            single_price = 0
            total_tickets = 0
            t_type = "flight"
            t_name = None
            t_label = "транспорт"

        logger.log_transport(transport, single_price, total_tickets, guests_cnt, t_label)

        if hotels and total_tickets > 0:
            for h in hotels:
                if h.receipt:
                    if is_train:
                        h.receipt.train_ticket_rub = total_tickets
                        h.receipt.flight_ticket_rub = 0
                    else:
                        h.receipt.flight_ticket_rub = total_tickets
                        h.receipt.train_ticket_rub = 0
                    h.receipt.transport_ticket_rub = total_tickets
                    h.receipt.ticket_price_per_person_rub = single_price
                    h.receipt.tickets_count = guests_cnt
                    h.receipt.transport_type = t_type
                    h.receipt.transport_name = t_name
                    transfer = h.receipt.transfer_cost_rub or 0
                    h.receipt.total_with_transport_rub = h.receipt.total_rub + transfer + total_tickets

        top_receipt = hotels[0].receipt if hotels else None
        if hotels and top_receipt is not None:
            top_h = hotels[0]
            top_rec = top_receipt
            rec_thought = f"Полный расчет поездки под ключ для «{top_h.name}»: отель {top_rec.total_rub:,} ₽ + трансфер ~{top_rec.transfer_cost_rub:,} ₽ + {t_label} = {top_rec.total_with_transport_rub:,} ₽".replace(",", " ")
            logger.log_thought("receipt_calculation", rec_thought)
            yield _format_sse("thought", {
                "step": "receipt_calculation",
                "text": rec_thought,
            })
        else:
            rec_thought = "Рассчитываю прозрачные чеки и проверяю правила отмены..."
            logger.log_thought("receipt_calculation", rec_thought)
            yield _format_sse("thought", {
                "step": "receipt_calculation",
                "text": rec_thought,
            })
        await asyncio.sleep(0.2)

        # 6. Стриминг текста ответа агента (Real LLM, без шаблонных повторов)
        async for chunk in generate_concierge_response_stream(message, slots, hotels, transport=transport):
            logger.log_token(chunk)
            yield _format_sse("token", {"content": chunk})
            
        # 7. Стриминг виджета (event: widget)
        chips_to_send = slots.disambiguation_suggestions or default_chips(
            message.lower(),
            origin=slots.origin_city,
            city=slots.city,
            transport_pref=slots.transport_preference,
            depart_date=slots.depart_date,
        )
        logger.log_chips(chips_to_send)

        widget_payload = {
            "type": "hotel_grid",
            "hotels": [h.model_dump() for h in hotels],
            "disambiguation_chips": chips_to_send,
            "transport_summary": transport.model_dump() if transport else None,
        }
        yield _format_sse("widget", widget_payload)
        
        # 8. Финализация
        logger.finish(status="ok")
        yield _format_sse("done", {"status": "ok"})
        
    except Exception as e:
        logger.finish(status="error", error=str(e))
        yield _format_sse("thought", {"step": "error", "text": f"Ошибка обработки: {str(e)}"})
        yield _format_sse("token", {"content": "Произошла ошибка при поиске отелей. Пожалуйста, попробуйте изменить запрос."})
        yield _format_sse("done", {"status": "error", "error": str(e)})

from ..services.text_helpers import (
    pluralize_guests as _pluralize_guests,
)
from ..services.text_helpers import (
    pluralize_hotels as _pluralize_hotels,
)
from ..services.text_helpers import (
    pluralize_nights as _pluralize_nights,
)


def _format_sse(event_type: str, data: dict[str, Any]) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


__all__ = [
    "run_agent_workflow",
    "_format_sse",
    "_pluralize_guests",
    "_pluralize_hotels",
    "_pluralize_nights",
]

