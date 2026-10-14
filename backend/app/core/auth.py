"""Studio authentication dependencies for team access."""
from typing import Optional
from fastapi import Header, Query, HTTPException, status
from ..config import settings


async def verify_team_token(
    x_studio_token: Optional[str] = Header(None, alias="X-Studio-Token"),
    token: Optional[str] = Query(None),
) -> str:
    """
    Проверяет валидность командного токена STUDIO_TEAM_TOKEN.
    Принимает токен из заголовка X-Studio-Token или query-параметра token.
    """
    provided_token = x_studio_token or token
    expected_token = getattr(settings, "STUDIO_TEAM_TOKEN", "")

    if not expected_token:
        # Если токен не настроен в .env, разрешаем локальный доступ
        return "local_developer"

    if not provided_token or provided_token.strip() != expected_token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или отсутствующий командный токен доступа (STUDIO_TEAM_TOKEN).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return provided_token
