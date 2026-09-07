"""Database initialization and readiness probe utilities."""

import time
from typing import Any, Dict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import get_logger

logger = get_logger("kritagas.db")


async def check_db_connection(session: AsyncSession) -> bool:
    """Execute a lightweight query to verify active database connectivity."""
    try:
        result = await session.execute(text("SELECT 1"))
        return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


async def check_db_readiness(session: AsyncSession) -> Dict[str, Any]:
    """Execute readiness check measuring response latency."""
    try:
        start = time.perf_counter()
        result = await session.execute(text("SELECT 1"))
        elapsed = (time.perf_counter() - start) * 1000.0
        is_ok = result.scalar() == 1
        return {
            "status": "connected" if is_ok else "disconnected",
            "latency_ms": round(elapsed, 2) if is_ok else None,
        }
    except Exception as e:
        logger.error(f"Database readiness probe failed: {e}")
        return {
            "status": "disconnected",
            "latency_ms": None,
        }
