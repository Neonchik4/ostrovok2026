import sys, os, asyncio
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.app.services.hotel_search_adapter import search_hotels_unified, warmup_models
from backend.app.schemas.chat import ExtractedSlots

warmup_models()

async def main():
    queries = [
        ("Красная Поляна с собакой и бассейном", ExtractedSlots(
            city="Красная Поляна",
            pet_friendly=True,
            heated_pool=True,
            semantic_query="отель с собакой и теплым бассейном у подъемника"
        )),
        ("Санкт-Петербург центр с завтраком", ExtractedSlots(
            city="Санкт-Петербург",
            breakfast_included=True,
            semantic_query="уютный бутик отель в центре с завтраком"
        )),
        ("Сочи у моря до 10000", ExtractedSlots(
            city="Сочи",
            max_price_per_night_rub=10000,
            semantic_query="отель на первой линии у моря с хорошим пляжем"
        )),
        ("Шерегеш шале у подъемника", ExtractedSlots(
            city="Шерегеш",
            semantic_query="шале сауна у подъемника"
        )),
        ("Мурманск северное сияние", ExtractedSlots(
            city="Мурманск",
            semantic_query="отель для наблюдения северного сияния"
        )),
    ]

    for title, slots in queries:
        print(f"\n==========================================")
        print(f"ПОИСК: {title}")
        print(f"==========================================")
        cards = await search_hotels_unified(slots)
        print(f"Найдено: {len(cards)} карточек")
        for i, c in enumerate(cards, 1):
            print(f"  {i}. {c.name} ({c.stars}*) [{c.city}]")
            print(f"     Match Score: {c.match_score_pct}% | Цена: {c.min_price_per_night_rub} руб/ночь | Рейтинг: {c.rating}")
            print(f"     Теги: {c.tags}")
            if c.image_urls:
                print(f"     Фото (CDN): {c.image_urls[0][:70]}...")

if __name__ == "__main__":
    asyncio.run(main())
