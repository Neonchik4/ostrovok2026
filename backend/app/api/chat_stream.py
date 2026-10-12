from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from ..schemas.chat import ChatStreamRequest
from ..graph.workflow import run_agent_workflow

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/stream")
async def stream_chat_post(req: ChatStreamRequest):
    """
    Основной SSE-эндпоинт стриминга чата.
    События: thought, token, widget, done.
    """
    return StreamingResponse(
        run_agent_workflow(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/stream")
async def stream_chat_get(
    message: str = Query(..., description="Запрос пользователя"),
    nights: int = Query(2),
    guests: int = Query(2),
    pets: int = Query(0),
    disambiguation: str = Query(None)
):
    """
    GET-версия SSE эндпоинта для удобного тестирования через EventSource / curl / браузер.
    """
    req = ChatStreamRequest(
        message=message,
        nights=nights,
        guests=guests,
        pets=pets,
        disambiguation_selection=disambiguation
    )
    return StreamingResponse(
        run_agent_workflow(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
