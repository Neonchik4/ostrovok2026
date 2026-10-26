import os

from app.schemas.chat import ChatStreamRequest, ExtractedSlots
from app.services.run_logger import WorkflowRunLogger


def test_workflow_run_logger_creates_and_formats_last_run_log():
    req = ChatStreamRequest(
        message="хочу в анапу для 4 человек на поезде",
        guests=4,
        nights=2,
    )
    logger = WorkflowRunLogger(req)

    slots = ExtractedSlots(
        city="Анапа",
        origin_city="Москва",
        guests_count=4,
        nights=2,
        transport_preference="train",
    )
    logger.log_slots(slots)
    logger.log_thought("reasoning", "Анализирую запрос на размещение 4 гостей")
    logger.log_transport(
        transport=None,
        single_price=3600,
        total_price=14400,
        count=4,
        label="поезд 102М (4 чел. по 3 600 ₽ = 14 400 ₽)",
    )
    logger.log_token("Для поездки компанией из четырех человек...")
    logger.log_chips(["В Анапу", "Хочу на поезде"])
    logger.finish(status="ok")

    log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "outputs"))
    last_run_path = os.path.join(log_dir, "last_run.log")
    history_path = os.path.join(log_dir, "runs_history.log")

    assert os.path.exists(last_run_path)
    with open(last_run_path, encoding="utf-8") as f:
        content = f.read()

    assert "ОСТРОВОК AI-АГЕНТ — ЛОГ ПОСЛЕДНЕГО ЗАПУСКА" in content
    assert "хочу в анапу для 4 человек на поезде" in content
    assert "Гости:            4 чел." in content
    assert "Цена за 1 билет:  3 600 ₽" in content
    assert "Кол-во билетов:   4 шт. (по числу гостей)" in content
    assert "Итого за билеты:  14 400 ₽" in content
    assert "Статус: OK" in content

    assert os.path.exists(history_path)
    with open(history_path, encoding="utf-8") as f:
        hist_content = f.read()
    assert "Guests: 4" in hist_content
