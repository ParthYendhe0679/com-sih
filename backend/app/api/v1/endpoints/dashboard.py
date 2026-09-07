"""Role-based operational dashboard analytics endpoints."""

from fastapi import APIRouter, Depends
from app.api.deps import (
    get_current_user,
    get_dashboard_service,
    require_roles,
)
from app.core.constants import UserRole
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.dashboard import (
    AdminDashboardResponse,
    CitizenDashboardResponse,
    PoliceDashboardResponse,
)
from app.services.dashboard_service import DashboardService
from app.utils.response import success_response

router = APIRouter()


@router.get(
    "/citizen",
    response_model=APIResponse[CitizenDashboardResponse],
    summary="Citizen Dashboard Analytics",
    description="Live complaint counts, pending triage, accepted records, and unread notifications.",
)
async def get_citizen_dashboard(
    current_user: User = Depends(get_current_user),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
):
    stats = await dashboard_service.get_citizen_dashboard(citizen=current_user)
    return success_response(data=stats, message="Citizen dashboard data retrieved.")


@router.get(
    "/police",
    response_model=APIResponse[PoliceDashboardResponse],
    summary="Police Dashboard Analytics",
    description="Active assigned investigations, station triage queue, and high-priority cases.",
)
async def get_police_dashboard(
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
):
    stats = await dashboard_service.get_police_dashboard(police=current_user)
    return success_response(data=stats, message="Police dashboard data retrieved.")


@router.get(
    "/admin",
    response_model=APIResponse[AdminDashboardResponse],
    summary="Admin Dashboard Analytics",
    description="System-wide user totals, case status breakdowns, and recent audit trails.",
)
async def get_admin_dashboard(
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
):
    stats = await dashboard_service.get_admin_dashboard()
    return success_response(data=stats, message="Admin dashboard data retrieved.")
