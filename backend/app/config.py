import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Явная загрузка .env из корня проекта
load_dotenv(BASE_DIR / ".env")
load_dotenv()

def _parse_api_keys() -> list[str]:
    """
    Единственный источник ключей Gemini: GEMINI_API_KEYS через запятую.
    Принимает любое количество — 1, 3, 5, сколько угодно: GEMINI_API_KEYS=key1 или
    GEMINI_API_KEYS=key1,key2,key3. Для обратной совместимости со старыми .env также
    читает GEMINI_API_KEY, если GEMINI_API_KEYS не задан.
    """
    raw = os.getenv("GEMINI_API_KEYS", "")
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    if keys:
        return keys
    single = os.getenv("GEMINI_API_KEY", "").strip()
    return [single] if single else []

class Settings(BaseModel):
    PROJECT_NAME: str = "Ostrovok Travel AI Agent"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    # development is host-only; production runs inside the Docker stack.
    APP_ENV: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    HOST: str = Field(default_factory=lambda: os.getenv("HOST", "127.0.0.1"))
    PORT: int = Field(default_factory=lambda: int(os.getenv("PORT", "8000")))

    # AI Studio / Gemini Keys & Cascading Models
    # GEMINI_API_KEYS — основная переменная, список ключей через запятую, 1..N без ограничений.
    GEMINI_API_KEYS: list[str] = Field(default_factory=lambda: _parse_api_keys())
    # GEMINI_API_KEY оставлен только для чтения в старом коде/логах — не использовать для новой логики,
    # источник правды — GEMINI_API_KEYS (первый элемент списка).
    GEMINI_API_KEY: str = Field(default_factory=lambda: _parse_api_keys()[0] if _parse_api_keys() else "")
    PRIMARY_MODEL: str = Field(default_factory=lambda: os.getenv("PRIMARY_MODEL", "gemini-3.5-flash-lite"))
    FALLBACK_MODEL: str = Field(default_factory=lambda: os.getenv("FALLBACK_MODEL", "gemini-3.5-flash"))
    FALLBACK_MODELS: list[str] = [
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
    ]
    GEMINI_BASE_URL: str = Field(default_factory=lambda: os.getenv("GEMINI_BASE_URL", ""))
    CLOUDFLARE_ACCOUNT_ID: str = Field(default_factory=lambda: os.getenv("CLOUDFLARE_ACCOUNT_ID", ""))
    CLOUDFLARE_AI_GATEWAY_TOKEN: str = Field(default_factory=lambda: os.getenv("CLOUDFLARE_AI_GATEWAY_TOKEN", ""))
    CLOUDFLARE_WORKER_URL: str = Field(default_factory=lambda: os.getenv("CLOUDFLARE_WORKER_URL", ""))
    STUDIO_TEAM_TOKEN: str = Field(default_factory=lambda: os.getenv("STUDIO_TEAM_TOKEN", ""))
    DATABASE_URL: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", ""))
    
    # Dataset & Vector DB Paths
    BASE_DIR: Path = BASE_DIR
    DATASET_PATH: str = Field(default_factory=lambda: os.getenv("DATASET_PATH", str(BASE_DIR / "outputs" / "hotels.json")))
    CHROMA_DB_PATH: str = Field(default_factory=lambda: os.getenv("CHROMA_DB_PATH", str(BASE_DIR / "outputs" / "chroma_db_v2")))

settings = Settings()
