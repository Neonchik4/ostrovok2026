# Dataset Generator & ChromaDB Index Builder (Ostrovok 2026)

Этот каталог содержит инструменты для воспроизводимой генерации синтетического датасета отелей и построения векторного индекса ChromaDB.

## Состав:
1. `generate_dataset.py` — автономный скрипт генерации 200 отелей (6 городов, полная схема `room_types`, правила отмены, депозиты за питомцев, координаты, отзывы). Сохраняет результат в `outputs/hotels_dataset.json`.
2. `build_chroma_index.py` — автономный скрипт генерации эмбеддингов через `paraphrase-multilingual-MiniLM-L12-v2` и построения векторного индекса `outputs/chroma_db_v2/`.
3. `main.ipynb` — оригинальный исследовательский Jupyter-ноутбук с прототипами и EDA.

## Запуск:
```bash
# 1. Генерация датасета (200 отелей)
python dataset_generator/generate_dataset.py

# 2. Построение векторной базы ChromaDB v2
python dataset_generator/build_chroma_index.py
```
