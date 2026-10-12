"""
Hotel Search Adapter Facade.
Оркестрирует поиск отелей, объединяя кэширование датасета и
детерминированные фильтры с расчетом прозрачного чека.
"""

from .vector_store import (
    init_dataset,
    warmup_models,
)
from .hotel_filters import (
    compute_calibrated_match_score,
    build_hotel_card,
)

# Псевдонимы для обратной совместимости
_compute_calibrated_match_score = compute_calibrated_match_score
_build_hotel_card = build_hotel_card

__all__ = [
    "warmup_models",
    "init_dataset",
    "compute_calibrated_match_score",
    "build_hotel_card",
    "_compute_calibrated_match_score",
    "_build_hotel_card",
]
