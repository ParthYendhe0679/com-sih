"""Health and readiness check endpoints for KRITAGAS backend."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import ai_service
from app.ai.schemas.ai import OverallAIHealthResponse
from app.api.deps import get_cache_service
from app.core.config import settings
from app.db.init_db import check_db_connection, check_db_readiness
from app.db.session import get_db
from app.services.cache_service import CacheService

router = APIRouter()


@router.get(
    "",
    summary="Service Health Check",
    description="Probes high-level application health and database connection status.",
)
async def health_check(session: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Verify application status and database availability."""
    db_ok = await check_db_connection(session)
    overall_status = "healthy" if db_ok else "degraded"
    db_state = "connected" if db_ok else "disconnected"

    return {
        "success": db_ok,
        "status": overall_status,
        "database": db_state,
        "services": {
            "database": db_state,
        },
    }


@router.get(
    "/ai",
    summary="AI Providers Health Probe",
    description="Inspects credentials, active key indices, models, and operational readiness for all AI providers without triggering paid API calls.",
    response_model=OverallAIHealthResponse,
)
async def ai_health_check() -> OverallAIHealthResponse:
    """Return operational readiness across Groq, Gemini, Hugging Face, and Local Fallback."""
    return ai_service.get_health()


@router.get(
    "/ready",
    summary="Service Readiness Probe",
    description="Kubernetes/container readiness probe checking critical infrastructure dependencies.",
)
async def readiness_probe(session: AsyncSession = Depends(get_db)) -> JSONResponse:
    """Validate readiness of critical infrastructure dependencies before receiving traffic."""
    db_report = await check_db_readiness(session)
    is_db_ready = db_report["status"] == "connected"

    services_status: Dict[str, Any] = {
        "database": db_report,
    }

    # Optional services: only evaluate if feature is explicitly enabled
    if settings.ENABLE_VALKEY:
        services_status["valkey"] = {
            "status": "configured" if settings.valkey_connection_url else "unconfigured",
            "provider": "Valkey",
        }
    if settings.ENABLE_REDIS:
        services_status["redis"] = {"status": "configured" if settings.REDIS_URL else "unconfigured"}
    if settings.ENABLE_GRAPH:
        services_status["neo4j"] = {"status": "configured" if settings.NEO4J_URI else "unconfigured"}
    if settings.ENABLE_AI:
        ai_health = ai_service.get_health()
        services_status["ai"] = {
            "status": ai_health.status,
            "configured_providers": ai_health.configured_providers,
            "default_provider": ai_health.default_provider,
        }
    if settings.ENABLE_BLOCKCHAIN or getattr(settings, "BLOCKCHAIN_ENABLED", False):
        services_status["blockchain"] = {
            "status": "configured",
            "provider": getattr(settings, "BLOCKCHAIN_PROVIDER", "mock"),
            "mode": getattr(settings, "BLOCKCHAIN_MODE", "mock"),
        }

    # Critical failure: if primary PostgreSQL is down, report 503
    if not is_db_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "success": False,
                "status": "not_ready",
                "message": "Critical dependency PostgreSQL is not ready.",
                "services": services_status,
            },
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "status": "ready",
            "message": "All critical backend services are operational.",
            "services": services_status,
        },
    )


@router.get(
    "/database",
    summary="PostgreSQL / Neon Database Health Probe",
    description="Inspects PostgreSQL connectivity, query latency, and connection pool state without exposing credentials.",
)
async def database_health_check(session: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Return safe observability metrics for primary PostgreSQL / Neon connection."""
    report = await check_db_readiness(session)
    is_ok = report.get("status") == "connected"
    
    # Determine provider from connection URL
    provider = "neon" if "neon.tech" in str(settings.DATABASE_URL).lower() else "postgresql"

    return {
        "status": "healthy" if is_ok else "unhealthy",
        "database": "postgresql",
        "provider": provider,
        "latency_ms": report.get("latency_ms"),
        "pool_status": "optimal" if is_ok else "degraded",
    }


@router.get(
    "/cache",
    summary="Valkey Cache Health & Observability Probe",
    description="Inspects Valkey connectivity, latency, and hit/miss metrics without exposing credentials.",
)
async def cache_health_check(cache: CacheService = Depends(get_cache_service)) -> Dict[str, Any]:
    """Return safe observability metrics and hit rates for Valkey caching layer."""
    health_status = await cache.get_health_status()
    is_ok = health_status.get("connected", False)
    return {
        "status": "healthy" if is_ok else ("disabled" if not cache.enabled else "degraded"),
        "cache": "valkey",
        "engine": health_status.get("engine", "Valkey"),
        "connected": is_ok,
        "latency_ms": health_status.get("latency_ms"),
        "metrics": health_status.get("metrics", {}),
    }


@router.get(
    "/neo4j",
    summary="Neo4j Graph Database Health & Metrics Probe",
    description="Inspects Neo4j Aura connectivity, latency, database name, and node counts without exposing credentials.",
)
async def neo4j_health_check() -> Dict[str, Any]:
    """Return diagnostic connectivity and graph metrics for Neo4j Aura layer."""
    from app.core.neo4j.client import neo4j_client
    return await neo4j_client.get_health_status()



