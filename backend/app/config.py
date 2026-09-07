import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Явная загрузка .env из корня проекта
load_dotenv(BASE_DIR / ".env")
load_dotenv()

class Settings(BaseModel):
    PROJECT_NAME: str = "Ostrovok Travel AI Agent"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    HOST: str = Field(default_factory=lambda: os.getenv("HOST", "127.0.0.1"))
    PORT: int = Field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    
    # AI Studio / Gemini Key & Cascading Models
    GEMINI_API_KEY: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    PRIMARY_MODEL: str = Field(default_factory=lambda: os.getenv("PRIMARY_MODEL", "gemini-3.5-flash-lite"))
    FALLBACK_MODEL: str = Field(default_factory=lambda: os.getenv("FALLBACK_MODEL", "gemini-3.5-flash"))
    FALLBACK_MODELS: list[str] = [
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
    ]
    
    # Dataset & Vector DB Paths
    BASE_DIR: Path = BASE_DIR
    DATASET_PATH: str = Field(default_factory=lambda: os.getenv("DATASET_PATH", str(BASE_DIR / "outputs" / "hotels_dataset.json")))
    CHROMA_DB_PATH: str = Field(default_factory=lambda: os.getenv("CHROMA_DB_PATH", str(BASE_DIR / "outputs" / "chroma_db_v2")))

settings = Settings()

# Автоматический fallback: если ключ не задан в .env, проверяем gemini_api.txt
if not settings.GEMINI_API_KEY:
    txt_candidates = [
        settings.BASE_DIR / "gemini_api.txt",
        Path("gemini_api.txt"),
        Path("../gemini_api.txt")
    ]
    for p in txt_candidates:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    key = f.read().strip()
                    if key:
                        settings.GEMINI_API_KEY = key
                        break
            except Exception:
                pass
