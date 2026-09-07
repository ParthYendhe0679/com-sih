"""Evidence metadata endpoints for physical, digital, and documentary artifacts."""

import math
import uuid
from fastapi import APIRouter, Depends, Query, Request, status
from app.api.deps import (
    get_client_ip,
    get_current_user,
    get_evidence_service,
)
from app.models.user import User
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.evidence import EvidenceCreate, EvidenceResponse
from app.services.evidence_service import EvidenceService
from app.utils.response import success_response

router = APIRouter()


@router.post(
    "",
    response_model=APIResponse[EvidenceResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register Evidence Metadata",
    description="Attach documentary, image, video, audio, or forensic evidence metadata to an FIR or Case.",
)
async def add_evidence(
    request: Request,
    body: EvidenceCreate,
    current_user: User = Depends(get_current_user),
    evidence_service: EvidenceService = Depends(get_evidence_service),
):
    client_ip = get_client_ip(request)
    evidence = await evidence_service.add_evidence_metadata(
        data=body,
        current_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=EvidenceResponse.model_validate(evidence),
        message="Evidence metadata recorded.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/{evidence_id}",
    response_model=APIResponse[EvidenceResponse],
    summary="Get Evidence By ID",
)
async def get_evidence(
    evidence_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    evidence_service: EvidenceService = Depends(get_evidence_service),
):
    evidence = await evidence_service.get_evidence_by_id(evidence_id, current_user=current_user)
    return success_response(
        data=EvidenceResponse.model_validate(evidence),
        message="Evidence retrieved.",
    )


@router.get(
    "/case/{case_id}",
    response_model=APIResponse[PaginatedResponse[EvidenceResponse]],
    summary="List Case Evidence",
)
async def list_case_evidence(
    case_id: uuid.UUID,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    evidence_service: EvidenceService = Depends(get_evidence_service),
):
    items = await evidence_service.list_by_case(
        case_id=case_id,
        current_user=current_user,
        page=page,
        size=size,
    )
    total = await evidence_service.count_by_case(case_id)
    total_pages = math.ceil(total / size) if size > 0 else 1

    paginated = PaginatedResponse(
        items=[EvidenceResponse.model_validate(e) for e in items],
        page=page,
        size=size,
        total=total,
        total_pages=total_pages,
    )
    return success_response(data=paginated, message="Case evidence retrieved.")


@router.get(
    "/fir/{fir_id}",
    response_model=APIResponse[PaginatedResponse[EvidenceResponse]],
    summary="List FIR Evidence",
)
async def list_fir_evidence(
    fir_id: uuid.UUID,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    evidence_service: EvidenceService = Depends(get_evidence_service),
):
    items = await evidence_service.list_by_fir(
        fir_id=fir_id,
        current_user=current_user,
        page=page,
        size=size,
    )
    total = await evidence_service.count_by_fir(fir_id)
    total_pages = math.ceil(total / size) if size > 0 else 1

    paginated = PaginatedResponse(
        items=[EvidenceResponse.model_validate(e) for e in items],
        page=page,
        size=size,
        total=total,
        total_pages=total_pages,
    )
    return success_response(data=paginated, message="FIR evidence retrieved.")
