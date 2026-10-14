"""Studio authentication dependencies for team access."""

from fastapi import Header, HTTPException, Query, status

from ..config import settings


async def verify_team_token(
    x_studio_token: str | None = Header(None, alias="X-Studio-Token"),
    token: str | None = Query(None),
) -> str:
    """
    Проверяет валидность командного токена STUDIO_TEAM_TOKEN.
    Принимает токен из заголовка X-Studio-Token или query-параметра token.
    """
    provided_token = x_studio_token or token
    expected_token = getattr(settings, "STUDIO_TEAM_TOKEN", "")

    is_dev = getattr(settings, "APP_ENV", "development").lower() != "production"
    if not expected_token or (is_dev and provided_token in ("dev_local_token", "local_developer")):
        # В режиме разработки разрешаем локальный доступ
        return "local_developer"

    if not provided_token or provided_token.strip() != expected_token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или отсутствующий командный токен доступа (STUDIO_TEAM_TOKEN).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return provided_token
