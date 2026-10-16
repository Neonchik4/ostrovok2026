from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from ..services.live.action_service import LiveActionResponse, LiveActionService
from ..services.live.proxy_service import LiveProxyService

router = APIRouter(prefix="/api/live", tags=["live-copilot"])
proxy_service = LiveProxyService()
action_service = LiveActionService()


class ActRequest(BaseModel):
    query: str = Field(description="Текстовый или расшифрованный голосовой запрос пользователя")
    persona: str | None = Field(default=None, description="Желаемая персона: bro | assistant | concierge")
    current_url: str | None = Field(default=None, description="Текущий адрес страницы поиска")


@router.get("/health")
async def live_health() -> dict[str, str]:
    return {"status": "ok", "module": "live-copilot-agent"}


@router.get("/proxy", response_class=HTMLResponse)
async def live_proxy_page(
    request: Request,
    path: str = Query(default="hotel/russia/sochi/", description="Путь на сайте Островка"),
) -> Response:
    """
    Проксирует страницу реального сайта Островка, убирает CSP и инжектирует Muse-агента.
    """
    params = dict(request.query_params)
    if "path" in params:
        del params["path"]

    status, headers, html = await proxy_service.fetch_page(path=path, query_params=params)
    return HTMLResponse(content=html, status_code=status, headers=headers)


@router.post("/act", response_model=LiveActionResponse)
async def live_act(body: ActRequest) -> LiveActionResponse:
    """
    Принимает пользовательскую команду и формирует план действий (DOM steps) и ToV-реплику.
    """
    return await action_service.plan_action(
        user_text=body.query,
        forced_persona=body.persona,
    )


@router.api_route("/proxy-api/{full_path:path}", methods=["GET", "POST", "OPTIONS"])
async def live_proxy_api(
    full_path: str,
    request: Request,
) -> Response:
    """
    Проксирует внутренние API запросы реального Островка для обхода CORS.
    """
    body = await request.body()
    status, headers, content = await proxy_service.proxy_api(
        method=request.method,
        path=full_path,
        headers=dict(request.headers),
        content=body if body else None,
        query_params=dict(request.query_params),
    )
    return Response(content=content, status_code=status, headers=headers)
