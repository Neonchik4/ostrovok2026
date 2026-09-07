from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .services.hotel_search_adapter import warmup_models
from .api.chat_stream import router as chat_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan менеджер: предзагрузка ChromaDB и SentenceTransformers на старте сервера.
    Исключает задержку первого запроса пользователя.
    """
    print("=== [Startup] Инициализация сервисов и моделей ===")
    warmup_models()
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

# Подключение роутов
app.include_router(chat_router, prefix=settings.API_PREFIX)

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
