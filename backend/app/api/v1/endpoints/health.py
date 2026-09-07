"""Health and readiness check endpoints for KRITAGAS backend."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import ai_service
from app.ai.schemas.ai import OverallAIHealthResponse
from app.core.config import settings
from app.db.init_db import check_db_connection, check_db_readiness
from app.db.session import get_db

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

