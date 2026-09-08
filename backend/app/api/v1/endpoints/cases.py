"""Case investigation endpoints for official inquiries, status transitions, and timeline audits."""

import math
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, Request, status
from app.api.deps import (
    get_cache_service,
    get_case_service,
    get_client_ip,
    get_current_user,
    get_fir_service,
    require_roles,
)
from app.core.constants import CasePriority, CaseStatus, UserRole
from app.core.exceptions import PermissionDeniedException
from app.models.user import User
from app.services.cache_service import CacheService
from app.schemas.case import (
    CaseAssignRequest,
    CaseCreate,
    CaseDetailResponse,
    CaseNoteCreate,
    CaseNoteResponse,
    CaseResponse,
    CaseStatusUpdateRequest,
    CaseTimelineEventResponse,
    CaseUpdate,
)
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.case_service import CaseService
from app.services.fir_service import FIRService
from app.utils.response import success_response

router = APIRouter()


@router.post(
    "",
    response_model=APIResponse[CaseResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create Investigation Case",
    description="Instantiate an official Case from an accepted FIR or direct offline intake.",
)
async def create_case(
    request: Request,
    body: CaseCreate,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    client_ip = get_client_ip(request)
    case = await case_service.create_case(data=body, police_user=current_user, client_ip=client_ip)
    return success_response(
        data=CaseResponse.model_validate(case),
        message=f"Case {case.case_number} created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/my-cases",
    response_model=APIResponse[PaginatedResponse[CaseResponse]],
    summary="Get Assigned Cases",
    description="List all active cases where the authenticated officer is designated lead investigator.",
)
async def get_my_cases(
    status_filter: Optional[CaseStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    cases = await case_service.list_my_cases(
        police_user=current_user,
        status=status_filter,
        page=page,
        size=size,
    )
    total = await case_service.count_my_cases(police_user=current_user, status=status_filter)
    total_pages = math.ceil(total / size) if size > 0 else 1

    paginated = PaginatedResponse(
        items=[CaseResponse.model_validate(c) for c in cases],
        page=page,
        size=size,
        total=total,
        total_pages=total_pages,
    )
    return success_response(data=paginated, message="Assigned cases retrieved.")


_IN_MEMORY_CASES_CACHE: dict = {}

@router.get(
    "",
    response_model=APIResponse[PaginatedResponse[CaseResponse]],
    summary="List Cases",
    description="List all criminal investigation Cases with optional status and priority filtering.",
)
async def list_cases(
    status_filter: Optional[CaseStatus] = Query(None, alias="status"),
    priority_filter: Optional[CasePriority] = Query(None, alias="priority"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
    cache: CacheService = Depends(get_cache_service),
):
    global _IN_MEMORY_CASES_CACHE
    import time
    now = time.time()
    cache_key = f"kritagas:cases:paginated:{status_filter}:{priority_filter}:{page}:{size}"

    # 1. Ultra-fast in-memory cache check (<1ms)
    if cache_key in _IN_MEMORY_CASES_CACHE:
        entry_time, cached_res = _IN_MEMORY_CASES_CACHE[cache_key]
        if now - entry_time < 60:
            return success_response(data=cached_res, message="Cases retrieved successfully.")

    # 2. Valkey distributed cache check
    try:
        cached_paginated = await cache.get(cache_key)
        if cached_paginated:
            validated = PaginatedResponse[CaseResponse].model_validate(cached_paginated)
            _IN_MEMORY_CASES_CACHE[cache_key] = (now, validated)
            return success_response(data=validated, message="Cases retrieved successfully.")
    except Exception:
        pass

    cases = await case_service.list_cases(
        status=status_filter,
        priority=priority_filter,
        page=page,
        size=size,
    )
    total = await case_service.count_cases(status=status_filter, priority=priority_filter)
    total_pages = math.ceil(total / size) if size > 0 else 1

    paginated = PaginatedResponse(
        items=[CaseResponse.model_validate(c) for c in cases],
        page=page,
        size=size,
        total=total,
        total_pages=total_pages,
    )

    _IN_MEMORY_CASES_CACHE[cache_key] = (now, paginated)
    try:
        await cache.set(cache_key, paginated.model_dump(mode="json"), ttl=120)
    except Exception:
        pass

    return success_response(data=paginated, message="Cases retrieved successfully.")


@router.get(
    "/{case_id}",
    response_model=APIResponse[CaseDetailResponse],
    summary="Get Case Details",
    description="Retrieve full Case intelligence details, notes, and attached evidence counts.",
)
async def get_case(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    cache: CacheService = Depends(get_cache_service),
    fir_service: FIRService = Depends(get_fir_service),
):
    cache_key = cache.keys.case(case_id)
    cached_data = await cache.get(cache_key)
    if cached_data is not None and isinstance(cached_data, dict):
        # Enforce security authorization before serving cached intelligence
        if current_user.role == UserRole.CITIZEN:
            fir_id_str = cached_data.get("fir_id")
            if not fir_id_str:
                raise PermissionDeniedException("Access restricted to authorized personnel.")
            fir = await fir_service.get_fir_by_id(uuid.UUID(fir_id_str), current_user=current_user)
            if not fir or fir.submitted_by_id != current_user.id:
                raise PermissionDeniedException("Access restricted to authorized personnel.")
        try:
            detail = CaseDetailResponse.model_validate(cached_data)
            return success_response(data=detail, message="Case details retrieved (cache).")
        except Exception:
            pass

    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    notes_resp = [
        CaseNoteResponse(
            id=n.id,
            case_id=n.case_id,
            author_id=n.author_id,
            note=n.note,
            created_at=n.created_at,
        )
        for n in (case.notes or [])
    ]

    detail = CaseDetailResponse(
        id=case.id,
        case_number=case.case_number,
        title=case.title,
        description=case.description,
        crime_category=case.crime_category,
        status=case.status,
        priority=case.priority,
        fir_id=case.fir_id,
        lead_investigator_id=case.lead_investigator_id,
        created_by_id=case.created_by_id,
        opened_at=case.opened_at,
        closed_at=case.closed_at,
        created_at=case.created_at,
        updated_at=case.updated_at,
        notes=notes_resp,
        evidence_count=len(case.evidence or []),
    )
    await cache.set(cache_key, detail.model_dump(mode="json"), ttl=cache.ttl.CASE)
    return success_response(data=detail, message="Case details retrieved.")


@router.patch(
    "/{case_id}",
    response_model=APIResponse[CaseResponse],
    summary="Update Case Metadata",
)
async def update_case(
    request: Request,
    case_id: uuid.UUID,
    body: CaseUpdate,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    client_ip = get_client_ip(request)
    updated = await case_service.update_case(
        case_id=case_id,
        data=body,
        police_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=CaseResponse.model_validate(updated),
        message="Case metadata updated.",
    )


@router.post(
    "/{case_id}/assign",
    response_model=APIResponse[CaseResponse],
    summary="Assign Lead Investigator",
    description="Designate or transfer lead investigative responsibility to a specific officer.",
)
async def assign_investigator(
    request: Request,
    case_id: uuid.UUID,
    body: CaseAssignRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    client_ip = get_client_ip(request)
    updated = await case_service.assign_lead_investigator(
        case_id=case_id,
        req=body,
        police_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=CaseResponse.model_validate(updated),
        message=f"Lead investigator assigned to Case {updated.case_number}.",
    )


@router.post(
    "/{case_id}/status",
    response_model=APIResponse[CaseResponse],
    summary="Update Case Status",
    description="Advance Case through workflow lifecycle with state transition validation.",
)
async def update_case_status(
    request: Request,
    case_id: uuid.UUID,
    body: CaseStatusUpdateRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    client_ip = get_client_ip(request)
    updated = await case_service.update_case_status(
        case_id=case_id,
        req=body,
        police_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=CaseResponse.model_validate(updated),
        message=f"Case status updated to {updated.status.value}.",
    )


@router.post(
    "/{case_id}/notes",
    response_model=APIResponse[CaseNoteResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Add Investigation Note",
    description="Append confidential field and investigator notes to the Case file.",
)
async def add_case_note(
    request: Request,
    case_id: uuid.UUID,
    body: CaseNoteCreate,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    client_ip = get_client_ip(request)
    note = await case_service.add_note(
        case_id=case_id,
        data=body,
        police_user=current_user,
        client_ip=client_ip,
    )
    return success_response(
        data=CaseNoteResponse.model_validate(note),
        message="Case note added.",
        status_code=status.HTTP_201_CREATED,
    )


@router.post(
    "/from-fir/{fir_id}",
    response_model=APIResponse[CaseResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Instantiate Case From FIR",
    description="Automatically create and link an official investigation Case from an accepted or uploaded FIR.",
)
async def create_case_from_fir(
    request: Request,
    fir_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    fir_service: FIRService = Depends(get_fir_service),
    case_service: CaseService = Depends(get_case_service),
):
    client_ip = get_client_ip(request)
    fir = await fir_service.get_fir_by_id(fir_id, current_user=current_user)
    case_payload = CaseCreate(
        title=f"Investigation: {fir.title}",
        description=fir.description,
        crime_category=fir.crime_category,
        priority=fir.priority,
        fir_id=fir.id,
    )
    case = await case_service.create_case(data=case_payload, police_user=current_user, client_ip=client_ip)
    return success_response(
        data=CaseResponse.model_validate(case),
        message=f"Case {case.case_number} instantiated from FIR {fir.fir_number}.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/{case_id}/timeline",
    response_model=APIResponse[List[CaseTimelineEventResponse]],
    summary="Get Case Timeline",
    description="Collate chronological events from audit records, FIR transitions, and investigator notes.",
)
async def get_case_timeline(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    timeline = await case_service.get_timeline(case_id)
    return success_response(
        data=timeline,
        message="Case timeline retrieved.",
    )


@router.get(
    "/{case_id}/network",
    response_model=APIResponse[Dict[str, Any]],
    summary="Get Case Intelligence Network",
    description="Retrieve nodes and relationships associated with the case for network visualization.",
)
async def get_case_network(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
    fir_service: FIRService = Depends(get_fir_service),
    cache: CacheService = Depends(get_cache_service),
):
    cache_key = cache.keys.case_network(case_id)
    cached_network = await cache.get(cache_key)
    if cached_network is not None and isinstance(cached_network, dict):
        return success_response(
            data=cached_network,
            message="Case network intelligence retrieved (cache).",
        )

    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    case_node_id = f"CASE-{case.case_number}"
    nodes = [
        {
            "id": case_node_id,
            "label": case.case_number,
            "type": "Case",
            "data": {
                "title": case.title,
                "status": case.status.value,
                "priority": case.priority.value,
                "crime": case.crime_category,
            },
        }
    ]
    edges = []

    if case.fir_id:
        try:
            fir = await fir_service.get_fir_by_id(case.fir_id, current_user=current_user)
            fir_node_id = f"FIR-{fir.fir_number}"
            nodes.append({
                "id": fir_node_id,
                "label": fir.fir_number,
                "type": "FIR",
                "data": {
                    "title": fir.title,
                    "location": fir.incident_location,
                    "is_offline": fir.is_offline,
                },
            })
            edges.append({
                "id": f"edge-case-{fir.id}",
                "source": case_node_id,
                "target": fir_node_id,
                "relationship": "ORIGINATED_FROM",
                "confidence": 100,
            })

            if fir.incident_location:
                loc_id = f"LOC-{abs(hash(fir.incident_location)) % 10000}"
                nodes.append({
                    "id": loc_id,
                    "label": fir.incident_location[:24],
                    "type": "Location",
                    "data": {"address": fir.incident_location},
                })
                edges.append({
                    "id": f"edge-fir-loc-{fir.id}",
                    "source": fir_node_id,
                    "target": loc_id,
                    "relationship": "LOCATED_AT",
                    "confidence": 95,
                })
        except Exception:
            pass

    for ev in (case.evidence or []):
        ev_node_id = f"EV-{ev.id}"
        nodes.append({
            "id": ev_node_id,
            "label": ev.title[:20],
            "type": "Evidence",
            "data": {
                "title": ev.title,
                "type": ev.evidence_type.value,
                "hash": ev.file_hash[:16] if ev.file_hash else "",
            },
        })
        edges.append({
            "id": f"edge-case-{ev.id}",
            "source": case_node_id,
            "target": ev_node_id,
            "relationship": "ATTACHED_EVIDENCE",
            "confidence": 100,
        })

    network_data = {
        "case_id": str(case.id),
        "case_number": case.case_number,
        "nodes": nodes,
        "edges": edges,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
    }
    await cache.set(cache_key, network_data, ttl=cache.ttl.NETWORK)

    return success_response(
        data=network_data,
        message="Case network intelligence retrieved.",
    )
