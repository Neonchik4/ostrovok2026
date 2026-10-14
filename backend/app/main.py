from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .middleware.body_limit import RequestBodyLimitMiddleware
from .services.hotel_search_adapter import warmup_models
from .services.runtime_guard import assert_safe_runtime, is_containerized
from .api.chat_stream import router as chat_router
from .api.hotels import router as hotels_router
from .api.studio import router as studio_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan менеджер: предзагрузка ChromaDB и SentenceTransformers на старте сервера.
    Исключает задержку первого запроса пользователя.
    """
    print("=== [Startup] Инициализация сервисов и моделей ===")
    assert_safe_runtime(settings.APP_ENV, is_containerized())
    from .services.dataset_loader import ensure_dataset_available
    try:
        ensure_dataset_available()
    except Exception as e:
        print(f"[Startup Warning] Ошибка при проверке датасета из S3: {e}")
    warmup_models()
    try:
        from .db.database import is_db_configured, init_db
        if is_db_configured():
            await init_db()
    except Exception as e:
        print(f"[Startup Warning] PostgreSQL не инициализирована: {e}")
    print("=== [Startup] Сервер готов к обработке запросов ===")
    yield
    print("=== [Shutdown] Остановка сервера ===")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Limit request bodies only; SSE response chunks pass through unchanged.
app.add_middleware(RequestBodyLimitMiddleware, max_bytes=2 * 1024 * 1024)

# Подключение роутов
app.include_router(chat_router, prefix=settings.API_PREFIX)
app.include_router(hotels_router, prefix=settings.API_PREFIX)
app.include_router(studio_router)

@app.get("/health")
@app.get(f"{settings.API_PREFIX}/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
