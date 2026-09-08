"""FastAPI endpoints for KRITAGAS Analytics Hub telemetry and AI predictive intelligence."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_async_session
from app.schemas.analytics import AnalyticsOverviewResponse
from app.schemas.common import APIResponse
from app.services.analytics_service import AnalyticsService
from app.utils.response import success_response

router = APIRouter()


@router.get(
    "/overview",
    response_model=APIResponse[AnalyticsOverviewResponse],
    summary="Analytics Hub Telemetry & Predictive Intelligence",
    description="Returns aggregated KPIs, monthly FIR volume trends, category breakdown, peak incident hours, city volumes, geospatial hotspot clusters, and AI predictive pattern threat models.",
)
async def get_analytics_overview(
    force_refresh: bool = Query(False, description="Bypass Valkey cache and recompute from raw PostgreSQL data"),
    session: AsyncSession = Depends(get_async_session),
):
    service = AnalyticsService(session)
    overview = await service.get_overview(force_refresh=force_refresh)
    return success_response(
        data=overview,
        message="Analytics hub telemetry and AI predictive intelligence retrieved successfully.",
    )
