import asyncio
import re
from collections.abc import AsyncGenerator
from typing import Any

from ..config import settings
from ..schemas.chat import ExtractedSlots
from .llm_client import stream_gemini_content
from .text_helpers import sanitize_user_input

SYSTEM_CONCIERGE_PROMPT = """Ты — персональный AI-консьерж сервиса бронирования отелей «Островок».
Твоя задача — дать четкий, полезный, профессиональный и человечный ответ пользователю без воды, шаблонных клише и слащавых фраз.

Правила:
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать шаблонные клише («Отличный выбор...», «Я нашел 6 отелей...», «...обещает стать прекрасным отдыхом», «...с радостью примут вас») или смайлики.
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вставлять в текст ответа сырые ссылки, URL-адреса или Markdown-ссылки вида `[Купить...](http...)`. Все ссылки и кнопки покупки билетов уже автоматически отображаются в интерфейсе справа на канвасе и в карточках.
3. Обязательно объясни логистику и дорогу: какой ближайший аэропорт или вокзал к выбранным отелям, сколько километров ехать и сколько займет времени дорога на такси/трансфере, как время прибытия состыкуется с заселением в отель (check-in) и выездом (check-out).
4. Если пользователь планирует поездку или билеты, но не указал даты, транспорт или бюджет — в самом конце ответа задай ровно 1-2 кратких уточняющих вопроса. Если город отправления уже указан, КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО переспрашивать город выезда/отправления!
5. Назови 1-2 конкретных отеля из списка, подчеркни их реальные факты под запрос (например: спа, подогреваемый бассейн, размещение с питомцем, вид).
6. Ответ должен быть компактным: 3-4 емких предложения по делу.
"""


_THEMATIC_INTRO = {
    "warm": "Для отдыха в теплых краях отлично подойдут курорты Черноморского побережья и юга: Сочи, Анапа, Геленджик или Дагестан. Подготовил подборку отелей с высоким рейтингом гостей и спа-зонами.",
    "sea": "Для отдыха на море отлично подойдут курорты Черного моря (Сочи, Анапа, Геленджик), Балтики (Зеленоградск) или Каспия (Дагестан). Подобрал комфортные варианты рядом с побережьем.",
    "mountains": "Для отдыха в горах отлично подойдут вершины Красной Поляны, снежные склоны Шерегеша или живописный Алтай. Отобрал отели с панорамными видами и доступом к трассам.",
    "nature": "Для отдыха на природе прекрасно подойдут побережье Байкала, озера и леса Карелии, первозданный Алтай или Мурманск. Собрал отели в окружении природы с высоким комфортом.",
    "culture": "Для экскурсий и культурного туризма рекомендую исторический Санкт-Петербург, колоритную Казань, купеческий Нижний Новгород или Калининград.",
}


def get_missing_clarifying_questions(slots: ExtractedSlots) -> list[str]:
    """Определяет до 2 ключевых недостающих параметров для состыковки поездки."""
    missing: list[str] = []
    if not slots.origin_city:
        missing.append("город выезда")
    if not slots.depart_date:
        missing.append("даты поездки")
    if not slots.transport_preference:
        missing.append("что предпочитаете — поезд или самолет")
    if not slots.max_price_per_night_rub and not slots.total_trip_budget_rub:
        missing.append("комфортный бюджет")
    return missing[:2]


ORIGIN_CLARIFY_QUESTION = (
    "Подскажите, из какого города вы выезжаете? Я сразу подберу удобные поезда или рейсы "
    "и включу трансфер от вокзала или аэропорта в общий чек поездки. (Или выберите подсказку ниже)."
)

def build_deterministic_concierge_response(
    user_message: str,
    slots: ExtractedSlots,
    hotels: list[Any],
    transport: Any | None = None,
) -> str:
    """
    Формирует качественный детерминированный диалоговый ответ агента без слащавых клише и спам-ссылок.
    """
    if not hotels:
        city = slots.city or "выбранном направлении"
        return f"Отели в {city} по вашему запросу не найдены. Попробуйте скорректировать фильтры или расширить ценовой диапазон."

    city = str(slots.city or getattr(hotels[0], "city", "выбранном регионе"))
    count = len(hotels)
    min_cost = min((getattr(h, "min_price_per_night_rub", 0) for h in hotels), default=0)
    top_names = [f"«{getattr(h, 'name', '')}»" for h in hotels[:2] if getattr(h, "name", None)]

    # Обработка разговорного интента review_inquiry (Issue #29)
    if slots.is_review_inquiry and hotels:
        top_h = hotels[0]
        rs = getattr(top_h, "review_summary", None)
        if not rs:
            from .tag_reviews import build_hotel_review_summary
            rs = build_hotel_review_summary(top_h)
        pros_text = "; ".join(rs.pros[:3]) if rs.pros else "высокий уровень комфорта и удобное расположение"
        cons_text = "; ".join(rs.cons[:2]) if rs.cons else "критических минусов гости не выделили"
        rating_val = f"{rs.rating:.1f}" if rs.rating else f"{getattr(top_h, 'rating', 8.5):.1f}"
        rev_cnt = rs.reviews_count or getattr(top_h, "reviews_count", 0)
        return (
            f"По отзывам гостей для «{top_h.name}» (рейтинг {rating_val}, {rev_cnt} отзывов):\n"
            f"Главные плюсы: {pros_text}.\n"
            f"Нюансы и минусы: {cons_text}."
        )

    parts = []

    # 1. Статус фильтрации и параметров
    if not slots.city and slots.thematic_category:
        parts.append(_THEMATIC_INTRO.get(slots.thematic_category, f"Сформировал подборку лучших вариантов по направлению «{slots.thematic_title or 'Россия'}»."))
    elif slots.max_price_per_night_rub and min_cost > slots.max_price_per_night_rub:
        parts.append(
            f"В рамках бюджета до {slots.max_price_per_night_rub:,} ₽ отелей в {city} не нашлось (минимальная цена от {min_cost:,} ₽), "
            f"поэтому я отобрал {count} наиболее доступных и проверенных вариантов в этом регионе.".replace(",", " ")
        )
    elif slots.stars and slots.free_cancellation:
        parts.append(f"По вашему запросу подобрал {count} отелей категории {slots.stars}★ в {city} с опцией бесплатной отмены.")
    elif slots.free_cancellation:
        parts.append(f"Подобрал отели в {city} с гарантией бесплатной отмены.")
    elif slots.pet_friendly and slots.heated_pool:
        parts.append(f"Подобрал варианты в {city} с подогреваемым бассейном и проживанием с питомцем.")
    elif slots.pet_friendly:
        parts.append(f"Подобрал отели в {city} с возможностью размещения с питомцем.")
    elif slots.heated_pool:
        parts.append(f"Подобрал отели в {city} с теплым бассейном.")
    elif slots.spa:
        parts.append(f"Подобрал отели в {city} со СПА-комплексом.")
    elif slots.stars:
        parts.append(f"Отобрал отели категории {slots.stars}★ в {city}.")
    else:
        parts.append(f"Сформировал подборку лучших вариантов в {city}.")

    # 2. Логистика: ближайший аэропорт / вокзал, расстояние в км, время и стоимость трансфера
    top_h = hotels[0] if hotels else None
    if top_h:
        station = getattr(top_h, "nearest_station", None)
        airport = getattr(top_h, "nearest_airport", None)
        hub = getattr(top_h, "nearest_hub", None)
        target_airport = airport or (hub if hub and getattr(hub, "hub_type", "") == "airport" else None)
        target_station = station or (hub if hub and getattr(hub, "hub_type", "") == "train_station" else None)
        checkin_time = getattr(top_h, "checkin_from", "14:00") or "14:00"
        checkout_time = getattr(top_h, "checkout_until", "12:00") or "12:00"

        logistics_items = []
        is_train_pref = slots.transport_preference == "train"

        if is_train_pref:
            arr_t = "08:15"
            tr_num = "поезд"
            if transport and getattr(transport, "recommended_train", None):
                tr = transport.recommended_train
                tr_num = tr.train_number
                if tr.arrival_at and len(tr.arrival_at) >= 16:
                    arr_t = tr.arrival_at[11:16]
            orig_txt = f" из {slots.origin_city}" if slots.origin_city else ""
            if target_station:
                st_name = target_station.name.replace("Ж/Д станция ", "").replace("Ж/Д вокзал ", "")
                st_dist = round(target_station.distance_km, 1)
                time_val = target_station.travel_time_min or target_station.taxi_time_min or 5
                logistics_items.append(
                    f"{tr_num}{orig_txt} прибывает на вокзал {st_name} в {arr_t}, откуда до отелей всего ~{st_dist} км ({time_val} мин на машине), успевая к заселению с {checkin_time} (выезд до {checkout_time})"
                )
            else:
                logistics_items.append(f"{tr_num}{orig_txt} прибывает в {arr_t}, успевая к заселению в отель с {checkin_time} (выезд до {checkout_time})")
        else:
            if transport and getattr(transport, "recommended_flight", None) and target_airport:
                fl = transport.recommended_flight
                arr_t = fl.arrival_at[11:16] if fl.arrival_at and len(fl.arrival_at) >= 16 else "13:45"
                air_name = target_airport.name.replace("Международный аэропорт ", "").replace(" (Адлер)", "")
                dist_val = round(target_airport.distance_km, 1)
                cost_str = f"{int(round(target_airport.taxi_cost_rub / 50.0) * 50):,}".replace(",", " ")
                orig_txt = f" из {slots.origin_city}" if slots.origin_city else ""
                logistics_items.append(
                    f"рейс{orig_txt} прилетает в аэропорт {air_name} в {arr_t}, оттуда до отелей ~{dist_val} км ({target_airport.taxi_time_min} минут на такси, ~{cost_str} ₽), как раз к заселению в {checkin_time} (выезд до {checkout_time})"
                )
            elif target_airport:
                air_name = target_airport.name.replace("Международный аэропорт ", "").replace(" (Адлер)", "")
                dist_val = round(target_airport.distance_km, 1)
                logistics_items.append(f"ближайший аэропорт {air_name} находится в {dist_val} км ({target_airport.taxi_time_min} мин на машине)")

            if target_station and target_station.distance_km <= 5.0:
                st_name = target_station.name.replace("Ж/Д станция ", "").replace("Ж/Д вокзал ", "")
                st_dist = round(target_station.distance_km, 1)
                time_val = target_station.travel_time_min or target_station.taxi_time_min or 5
                logistics_items.append(f"ж/д станция {st_name} совсем рядом — всего в {st_dist} км ({time_val} мин)")

        if slots.departure_time:
            logistics_items.append(f"обратный выезд в {slots.departure_time} состыкован с расчетным часом отеля (выезд до {checkout_time})")

        if logistics_items:
            parts.append("По логистике: " + "; ".join(logistics_items) + ".")

    # 3. Рекомендация 1-2 лучших отелей
    if top_names:
        parts.append(f"Обратите внимание на {', '.join(top_names)} — они полностью соответствуют вашим критериям.")

    is_user_dispute = bool(re.search(
        r"\b(?:почему|зачем|откуда|как так|вместо|не сходится|разниц|ошибк|претензи|я (?:же )?(?:писал|говорил|просил))\b",
        user_message.lower(),
    ))

    # 4. Вопрос про недостающие параметры поездки (максимум 2 вопроса).
    # Проактивный slot-filling: при ясной цели, но неизвестном городе выезда —
    # ровно один конкретный вопрос с ценностью (Issue #40, F06).
    if is_user_dispute:
        parts.append("Скорректировал выборку строго под ваш суммарный бюджет под ключ: все варианты и полный расчёт чека отображены справа.")
    elif slots.needs_origin_clarification:
        parts.append(ORIGIN_CLARIFY_QUESTION)
    elif not slots.city and slots.candidate_cities:
        if not slots.depart_date:
            parts.append("Какой курорт вам ближе и на какие даты планируете поездку? (Или выберите подсказку ниже).")
        else:
            parts.append("Какой курорт или город вам ближе? (Или выберите подсказку ниже).")
    else:
        top_missing = get_missing_clarifying_questions(slots)
        if top_missing:
            if len(top_missing) == 2:
                parts.append(
                    f"Чтобы состыковать билеты и точный чек поездки, уточните: {top_missing[0]} и {top_missing[1]}? (Или выберите подсказку ниже)."
                )
            else:
                parts.append(
                    f"Чтобы составить точный расчет билетов и чека под ключ, подскажите: {top_missing[0]}? (Или выберите подсказку ниже)."
                )
        else:
            parts.append("Все варианты билетов с расчетом всей поездки под ключ прикреплены в карточках справа.")
    return " ".join(parts)

async def generate_concierge_response_stream(
    user_message: str,
    slots: ExtractedSlots,
    hotels: list[Any],
    transport: Any | None = None,
) -> AsyncGenerator[str, None]:
    """
    Генерирует живой диалоговый ответ агента Островка (Real LLM с каскадом).
    """
    safe_message = sanitize_user_input(user_message, max_length=1000)

    hotel_summaries = []
    for h in hotels[:3]:
        amenities = []
        if getattr(h, "stars", None):
            amenities.append(f"{h.stars}★")
        if getattr(h, "match_score_pct", None):
            amenities.append(f"Match {h.match_score_pct}%")
        if getattr(h, "min_price_per_night_rub", None):
            amenities.append(f"от {h.min_price_per_night_rub:,} ₽".replace(",", " "))
        rs = getattr(h, "review_summary", None)
        if rs and (rs.pros or rs.cons):
            p_text = f"плюсы: {'; '.join(rs.pros[:3])}" if rs.pros else ""
            c_text = f"минусы: {'; '.join(rs.cons[:2])}" if rs.cons else ""
            rev_details = ", ".join(filter(None, [p_text, c_text]))
            amenities.append(f"отзывы {rs.rating}★ ({rev_details})")
        hotel_summaries.append(f"• «{getattr(h, 'name', '')}» ({getattr(h, 'city', '')}, {', '.join(amenities)})")

    hotels_context = "\n".join(hotel_summaries) if hotel_summaries else "Отели не найдены"
    min_cost = min((getattr(h, "min_price_per_night_rub", 0) for h in hotels), default=0)
    budget_note = ""
    if slots.max_price_per_night_rub and min_cost > slots.max_price_per_night_rub:
        budget_note = f"\nВажно: бюджет гостя {slots.max_price_per_night_rub} ₽ ниже минимальной цены в регионе ({min_cost} ₽). Поясни это и представь варианты от {min_cost} ₽."

    # Данные о логистике и расстоянии для промпта
    logistics_prompt_note = ""
    is_train_pref = slots.transport_preference == "train"
    if hotels:
        top_h = hotels[0]
        airport = getattr(top_h, "nearest_airport", None) or getattr(top_h, "nearest_hub", None)
        station = getattr(top_h, "nearest_station", None)
        checkin = getattr(top_h, "checkin_from", "14:00") or "14:00"
        checkout = getattr(top_h, "checkout_until", "12:00") or "12:00"
        lines = []
        if is_train_pref:
            if station:
                lines.append(f"Поезд прибывает на вокзал: {station.name}, расстояние до отеля {station.distance_km} км ({station.travel_time_min or station.taxi_time_min} мин на машине). Время заезда в отель: с {checkin}, выезд до {checkout}.")
        else:
            if airport:
                lines.append(f"Ближайший аэропорт: {airport.name}, расстояние до отеля {airport.distance_km} км, время на такси {airport.taxi_time_min} мин (~{airport.taxi_cost_rub} ₽)")
            if station:
                lines.append(f"Ближайший вокзал/станция: {station.name}, расстояние до отеля {station.distance_km} км ({station.travel_time_min or station.taxi_time_min} мин)")
            if transport and getattr(transport, "arrival_time", None):
                lines.append(f"Время прибытия транспорта: {transport.arrival_time}. Заезд в отель (check-in): с {checkin}, выезд (check-out): до {checkout}.")
        if lines:
            logistics_prompt_note = "\nЛогистика и расстояния (обязательно упомяни в ответе):\n" + "\n".join(lines)

    top_missing = get_missing_clarifying_questions(slots)
    is_user_dispute = bool(re.search(
        r"\b(?:почему|зачем|откуда|как так|вместо|не сходится|разниц|ошибк|претензи|я (?:же )?(?:писал|говорил|просил))\b",
        safe_message.lower(),
    ))
    if is_user_dispute:
        missing_note = (
            "\nВнимание: гость задаёт вопрос, уточнение или претензию по бюджету или предыдущему ответу. "
            "Дай чёткое, прямое и вежливое разъяснение по существу вопроса гостя, опираясь на расчёт чека под ключ. "
            "Категорически запрещено повторять шаблонные вопросы о датах и транспорте в конце ответа!"
        )
    elif slots.needs_origin_clarification:
        missing_note = (
            "\nВнимание: гость еще не указал город отправления, при этом цель поездки уже понятна. "
            "В самом конце ответа задай ровно один короткий вопрос: из какого города он выезжает. "
            "Подчеркни ценность: с городом отправления ты сразу подберешь удобные поезда или рейсы "
            "и включишь трансфер от вокзала или аэропорта в общий чек поездки. Другие параметры не спрашивай."
        )
    elif top_missing:
        orig_reminder = (
            f" Город отправления («{slots.origin_city}») гость УЖЕ УКАЗАЛ — ни в коем случае НЕ спрашивай город выезда!"
            if slots.origin_city else ""
        )
        missing_note = (
            f"\nВнимание: гость еще не указал: {', '.join(top_missing)}. "
            f"В самом конце своего ответа задай ровно {len(top_missing)} коротких естественных уточняющих вопроса об этих параметрах, "
            f"не повторяя шаблонных заученных формулировок.{orig_reminder}"
        )
    else:
        missing_note = "\nВнимание: параметры поездки и бюджет уже известны. В самом конце ответа НЕ задавай никаких вопросов!"

    route_info = f"маршрут: из {slots.origin_city} в {slots.city}" if slots.origin_city else f"город {slots.city or 'не указан'}"
    transport_pref_note = ""
    if is_train_pref:
        transport_pref_note = "\nВажно: гость выбрал поездку на поезде! Описывай дорогу от вокзала и не упоминай самолеты/аэропорты."

    thematic_note = ""
    if not slots.city and slots.thematic_title:
        cand_list = ", ".join(slots.candidate_cities) if slots.candidate_cities else ""
        thematic_note = (
            f"\nВажно: пользователь ищет отдых по тематике («{slots.thematic_title}»), а не конкретный город. "
            f"Рекомендуемые курорты/направления: {cand_list}. Порекомендуй подходящие курорты и предложи гостю выбрать желаемое направление."
        )

    review_inquiry_note = ""
    if slots.is_review_inquiry:
        review_inquiry_note = (
            "\nВажно: гость спрашивает про отзывы, репутацию, плюсы и минусы отеля. "
            "Дай емкую и объективную выжимку мнений гостей на основе предоставленных данных (плюсы и минусы) без галлюцинаций."
        )

    prompt_text = (
        f"{SYSTEM_CONCIERGE_PROMPT}\n\n"
        f"Запрос пользователя: «{safe_message}»\n"
        f"Параметры: {route_info}, {slots.guests_count or 2} гостей, {slots.nights or 2} ночей.{thematic_note}{budget_note}{transport_pref_note}{logistics_prompt_note}{review_inquiry_note}{missing_note}\n"
        f"Найденные отели (всего {len(hotels)} шт.):\n{hotels_context}\n\n"
        f"Ответ агента:"
    )

    if settings.GEMINI_API_KEY and hotels:
        has_content = False
        async for chunk in stream_gemini_content(prompt_text, timeout_sec=5.0, stage="response"):
            has_content = True
            yield chunk
        if has_content:
            return

    # Детерминированный живой ответ
    fallback_text = build_deterministic_concierge_response(safe_message, slots, hotels, transport)
    words = fallback_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield chunk
        await asyncio.sleep(0.02)
