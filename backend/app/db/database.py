"""Database connection, async engine and session management."""
import ssl
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ..config import settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def is_db_configured() -> bool:
    """Проверяет, задан ли корректный DATABASE_URL."""
    return bool(settings.DATABASE_URL and settings.DATABASE_URL.startswith("postgresql"))


def get_engine() -> AsyncEngine | None:
    """Возвращает singleton асинхронного движка SQLAlchemy."""
    global _engine, _session_factory
    if _engine is not None:
        return _engine

    if not is_db_configured():
        return None

    db_url = settings.DATABASE_URL.strip()
    # Обеспечиваем протокол postgresql+asyncpg
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    connect_args = {}
    if "sslmode=verify-full" in db_url or "sslmode=require" in db_url:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_ctx
        # Убираем sslmode из URL, так как asyncpg принимает объект ssl в connect_args
        clean_url = db_url.split("?")[0]
    else:
        clean_url = db_url

    try:
        _engine = create_async_engine(
            clean_url,
            connect_args=connect_args,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            echo=False,
        )
        _session_factory = async_sessionmaker(
            bind=_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
        return _engine
    except Exception as e:
        print(f"[DB Warning] Не удалось инициализировать engine БД: {e}")
        _engine = None
        _session_factory = None
        return None


async def init_db() -> bool:
    """Проверяет подключение к БД и активирует расширение vector при необходимости."""
    engine = get_engine()
    if not engine:
        return False
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            # Активируем расширение pgvector
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            from .models import Base
            await conn.run_sync(Base.metadata.create_all)
        print("[DB] Подключение к PostgreSQL успешно установлено. Расширение pgvector активно.")
        return True
    except Exception as e:
        print(f"[DB Warning] Ошибка подключения к базе данных: {e}")
        return False


async def get_db() -> AsyncGenerator[AsyncSession | None, None]:
    """FastAPI зависимость для сессии БД."""
    global _session_factory
    if _session_factory is None:
        get_engine()

    if _session_factory is None:
        yield None
        return

    async with _session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
