"""Administrative governance endpoints for user lifecycle, police onboarding, and audit inspection."""

import math
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, Request, status
from app.api.deps import (
    get_audit_service,
    get_client_ip,
    get_dashboard_service,
    get_user_service,
    require_roles,
)
from app.core.constants import UserRole
from app.models.user import User
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.dashboard import AdminDashboardResponse, AuditLogSummary
from app.schemas.user import PoliceAccountCreate, UserResponse, UserStatusUpdate
from app.services.audit_service import AuditService
from app.services.dashboard_service import DashboardService
from app.services.user_service import UserService
from app.utils.response import success_response

router = APIRouter()


@router.get(
    "/users",
    response_model=APIResponse[PaginatedResponse[UserResponse]],
    summary="List All Users",
    description="Retrieve paginated platform users with optional role and status filters.",
)
async def list_users(
    role: Optional[UserRole] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    user_service: UserService = Depends(get_user_service),
):
    users = await user_service.list_users(role=role, is_active=is_active, page=page, size=size)
    total = await user_service.count_users(role=role, is_active=is_active)
    total_pages = math.ceil(total / size) if size > 0 else 1

    paginated = PaginatedResponse(
        items=[UserResponse.model_validate(u) for u in users],
        page=page,
        size=size,
        total=total,
        total_pages=total_pages,
    )
    return success_response(data=paginated, message="Users retrieved.")


@router.patch(
    "/users/{user_id}/status",
    response_model=APIResponse[UserResponse],
    summary="Activate / Deactivate User",
    description="Change account active status with mandatory audit record.",
)
async def set_user_status(
    request: Request,
    user_id: uuid.UUID,
    body: UserStatusUpdate,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    user_service: UserService = Depends(get_user_service),
):
    client_ip = get_client_ip(request)
    updated = await user_service.set_user_status(
        user_id=user_id,
        is_active=body.is_active,
        admin_user=current_user,
        client_ip=client_ip,
    )
    action_str = "activated" if body.is_active else "deactivated"
    return success_response(
        data=UserResponse.model_validate(updated),
        message=f"User '{updated.username}' {action_str} successfully.",
    )


@router.post(
    "/police-account",
    response_model=APIResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Provision Police Officer Account",
    description="Admin creation of authenticated police credentials and department profile.",
)
async def create_police_account(
    request: Request,
    body: PoliceAccountCreate,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    user_service: UserService = Depends(get_user_service),
):
    client_ip = get_client_ip(request)
    police_user = await user_service.create_police_account(
        req=body,
        admin_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=UserResponse.model_validate(police_user),
        message=f"Police account for officer '{police_user.full_name}' created.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/audit-logs",
    response_model=APIResponse[List[AuditLogSummary]],
    summary="Inspect Audit Logs",
    description="Review immutable, tamper-evident audit records across all administrative and investigative actions.",
)
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    audit_service: AuditService = Depends(get_audit_service),
):
    logs = await audit_service.get_recent_logs(limit=limit)
    summaries = [
        AuditLogSummary(
            id=log.id,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            description=log.description,
            user_id=log.user_id,
            created_at=log.created_at,
        )
        for log in logs
    ]
    return success_response(data=summaries, message="Audit logs retrieved.")


@router.get(
    "/stats",
    response_model=APIResponse[AdminDashboardResponse],
    summary="Platform System Statistics",
    description="High-level operational metrics, distributions, and recent audit activity.",
)
async def get_admin_stats(
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
):
    stats = await dashboard_service.get_admin_dashboard()
    return success_response(data=stats, message="System statistics retrieved.")
