"""First Information Report (FIR) endpoints for citizen complaints and police triage."""

import math
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, Request, status
from app.api.deps import (
    get_client_ip,
    get_current_user,
    get_fir_service,
    require_roles,
)
from app.core.constants import FIRPriority, FIRStatus, UserRole
from app.models.user import User
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.fir import (
    FIRCreate,
    FIRDetailResponse,
    FIRInfoRequest,
    FIRProvideInfoRequest,
    FIRResponse,
    FIRReviewRequest,
    FIRUpdate,
)
from app.services.fir_service import FIRService
from app.utils.response import success_response

router = APIRouter()


@router.post(
    "",
    response_model=APIResponse[FIRDetailResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create Complaint / FIR",
    description="Lodge a new FIR in DRAFT status (or SUBMITTED if submitted_immediately=True).",
)
async def create_fir(
    request: Request,
    body: FIRCreate,
    submit_now: bool = Query(False, description="Set True to submit directly for triage review"),
    current_user: User = Depends(get_current_user),
    fir_service: FIRService = Depends(get_fir_service),
):
    client_ip = get_client_ip(request)
    fir = await fir_service.create_fir(
        data=body,
        citizen_user=current_user,
        client_ip=client_ip,
        auto_submit=submit_now,
    )
    return success_response(
        data=FIRDetailResponse.model_validate(fir),
        message=f"FIR {fir.fir_number} created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/my-firs",
    response_model=APIResponse[PaginatedResponse[FIRResponse]],
    summary="Get My Complaints (Citizen)",
    description="List all complaints and FIRs filed by the authenticated citizen.",
)
async def get_my_firs(
    status_filter: Optional[FIRStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    fir_service: FIRService = Depends(get_fir_service),
):
    firs = await fir_service.list_citizen_firs(
        citizen_user=current_user,
        status=status_filter,
        page=page,
        size=size,
    )
    total = await fir_service.count_citizen_firs(citizen_user=current_user, status=status_filter)
    total_pages = math.ceil(total / size) if size > 0 else 1

    paginated = PaginatedResponse(
        items=[FIRResponse.model_validate(f) for f in firs],
        page=page,
        size=size,
        total=total,
        total_pages=total_pages,
    )
    return success_response(data=paginated, message="Complaints retrieved successfully.")


@router.get(
    "",
    response_model=APIResponse[PaginatedResponse[FIRResponse]],
    summary="List FIRs (Role Adaptive)",
    description="Police officers view the triage review queue; Admins view all complaints; Citizens view their own.",
)
async def list_firs(
    status_filter: Optional[FIRStatus] = Query(None, alias="status"),
    priority_filter: Optional[FIRPriority] = Query(None, alias="priority"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    fir_service: FIRService = Depends(get_fir_service),
):
    if current_user.role == UserRole.CITIZEN:
        firs = await fir_service.list_citizen_firs(current_user, status=status_filter, page=page, size=size)
        total = await fir_service.count_citizen_firs(current_user, status=status_filter)
    else:
        firs = await fir_service.list_police_queue(
            status=status_filter,
            priority=priority_filter,
            page=page,
            size=size,
        )
        total = await fir_service.count_police_queue(status=status_filter, priority=priority_filter)

    total_pages = math.ceil(total / size) if size > 0 else 1
    paginated = PaginatedResponse(
        items=[FIRResponse.model_validate(f) for f in firs],
        page=page,
        size=size,
        total=total,
        total_pages=total_pages,
    )
    return success_response(data=paginated, message="FIR list retrieved.")


@router.get(
    "/{fir_id}",
    response_model=APIResponse[FIRDetailResponse],
    summary="Get FIR Details",
    description="Retrieve comprehensive details for an FIR. Citizens can only inspect their own complaints.",
)
async def get_fir(
    fir_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    fir_service: FIRService = Depends(get_fir_service),
):
    fir = await fir_service.get_fir_by_id(fir_id, current_user=current_user)
    return success_response(
        data=FIRDetailResponse.model_validate(fir),
        message="FIR details retrieved.",
    )


@router.patch(
    "/{fir_id}",
    response_model=APIResponse[FIRDetailResponse],
    summary="Update Draft FIR",
    description="Update an FIR while it is still in DRAFT status.",
)
async def update_fir(
    fir_id: uuid.UUID,
    body: FIRUpdate,
    current_user: User = Depends(get_current_user),
    fir_service: FIRService = Depends(get_fir_service),
):
    updated = await fir_service.update_draft_fir(fir_id=fir_id, data=body, citizen_user=current_user)
    return success_response(
        data=FIRDetailResponse.model_validate(updated),
        message="Draft complaint updated.",
    )


@router.post(
    "/{fir_id}/submit",
    response_model=APIResponse[FIRDetailResponse],
    summary="Submit Draft FIR",
    description="Submit a draft FIR for police review and triage (DRAFT -> SUBMITTED).",
)
async def submit_fir(
    request: Request,
    fir_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    fir_service: FIRService = Depends(get_fir_service),
):
    client_ip = get_client_ip(request)
    fir = await fir_service.submit_draft_fir(fir_id=fir_id, citizen_user=current_user, client_ip=client_ip)
    return success_response(
        data=FIRDetailResponse.model_validate(fir),
        message=f"FIR {fir.fir_number} submitted for review.",
    )


@router.post(
    "/{fir_id}/review",
    response_model=APIResponse[FIRDetailResponse],
    summary="Police Review Decision",
    description="Review an FIR and transition its status (ACCEPTED, REJECTED, MORE_INFORMATION_REQUIRED).",
)
async def review_fir(
    request: Request,
    fir_id: uuid.UUID,
    body: FIRReviewRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    fir_service: FIRService = Depends(get_fir_service),
):
    client_ip = get_client_ip(request)
    fir = await fir_service.review_fir(
        fir_id=fir_id,
        review_data=body,
        police_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=FIRDetailResponse.model_validate(fir),
        message=f"FIR {fir.fir_number} reviewed. Status updated to {fir.status.value}.",
    )


@router.post(
    "/{fir_id}/request-information",
    response_model=APIResponse[FIRDetailResponse],
    summary="Request Additional Information",
    description="Police officer requests further clarification from the complainant.",
)
async def request_information(
    request: Request,
    fir_id: uuid.UUID,
    body: FIRInfoRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    fir_service: FIRService = Depends(get_fir_service),
):
    client_ip = get_client_ip(request)
    fir = await fir_service.request_additional_information(
        fir_id=fir_id,
        instructions=body.instructions,
        police_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=FIRDetailResponse.model_validate(fir),
        message="Additional information requested from citizen.",
    )


@router.post(
    "/{fir_id}/provide-information",
    response_model=APIResponse[FIRDetailResponse],
    summary="Provide Additional Information",
    description="Citizen submits information requested by police, returning FIR to triage queue.",
)
async def provide_information(
    request: Request,
    fir_id: uuid.UUID,
    body: FIRProvideInfoRequest,
    current_user: User = Depends(get_current_user),
    fir_service: FIRService = Depends(get_fir_service),
):
    client_ip = get_client_ip(request)
    fir = await fir_service.provide_additional_information(
        fir_id=fir_id,
        response_text=body.additional_information,
        citizen_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=FIRDetailResponse.model_validate(fir),
        message="Information successfully provided.",
    )
