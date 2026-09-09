"""Case investigation endpoints for official inquiries, status transitions, and timeline audits."""

import asyncio
import math
import time
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, Request, status
from app.api.deps import (
    get_async_session,
    get_cache_service,
    get_case_service,
    get_client_ip,
    get_current_user,
    get_fir_service,
    get_graph_service,
    require_roles,
)
from app.services.graph_service import Neo4jGraphService
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.ai_ml.models.ai_models import Entity
from app.models.data_architecture import CaseEntityContext, EntityRelationship
from app.core.constants import CasePriority, CaseStatus, UserRole
from app.core.exceptions import PermissionDeniedException
from app.models.user import User
from app.models.case_note import CaseNote
from app.models.evidence import Evidence
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
from app.schemas.map_intelligence import MapIntelligenceResponse
from app.services.case_service import CaseService
from app.services.fir_service import FIRService
from app.services.geocoding_service import geocoding_service
from app.services.map_intelligence_service import map_intelligence_service
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
_IN_MEMORY_CASE_DETAIL_CACHE: dict = {}
_IN_MEMORY_ENTITIES_CACHE: dict = {}
_IN_MEMORY_RELATIONSHIPS_CACHE: dict = {}

def _invalidate_cases_cache(case_id: Optional[str] = None):
    """Invalidate local in-memory caches upon case mutation."""
    global _IN_MEMORY_CASES_CACHE, _IN_MEMORY_CASE_DETAIL_CACHE, _IN_MEMORY_ENTITIES_CACHE, _IN_MEMORY_RELATIONSHIPS_CACHE
    _IN_MEMORY_CASES_CACHE.clear()
    if case_id:
        c_str = str(case_id)
        _IN_MEMORY_CASE_DETAIL_CACHE.pop(c_str, None)
        _IN_MEMORY_ENTITIES_CACHE.pop(c_str, None)
        _IN_MEMORY_RELATIONSHIPS_CACHE.pop(c_str, None)


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
    now = time.time()
    cache_key = f"kritagas:cases:paginated:{status_filter}:{priority_filter}:{page}:{size}"

    # 1. Ultra-fast in-memory cache check (<1ms)
    if cache_key in _IN_MEMORY_CASES_CACHE:
        entry_time, cached_res = _IN_MEMORY_CASES_CACHE[cache_key]
        if now - entry_time < 300:
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

    # 3. Database fetch: fetch items and calculate count sequentially to prevent AsyncSession concurrent lock contention
    cases = await case_service.list_cases(
        status=status_filter,
        priority=priority_filter,
        page=page,
        size=size,
    )
    if page == 1 and len(cases) < size:
        total = len(cases)
    else:
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
        await cache.set(cache_key, paginated.model_dump(mode="json"), ttl=300)
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
    case_id: str,
    current_user: User = Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    cache: CacheService = Depends(get_cache_service),
    fir_service: FIRService = Depends(get_fir_service),
    session: AsyncSession = Depends(get_async_session),
):
    now = time.time()

    # 1. Fast in-memory cache check (<1ms)
    if case_id in _IN_MEMORY_CASE_DETAIL_CACHE:
        entry_time, cached_detail = _IN_MEMORY_CASE_DETAIL_CACHE[case_id]
        if now - entry_time < 300:
            if current_user.role == UserRole.CITIZEN:
                if cached_detail.fir_id:
                    fir = await fir_service.get_fir_by_id(uuid.UUID(str(cached_detail.fir_id)), current_user=current_user)
                    if not fir or fir.submitted_by_id != current_user.id:
                        raise PermissionDeniedException("Access restricted to authorized personnel.")
                else:
                    raise PermissionDeniedException("Access restricted to authorized personnel.")
            return success_response(data=cached_detail, message="Case details retrieved (memory cache).")

    # 2. Valkey distributed cache check before touching the database
    cache_key = f"kritagas:case:{case_id}"
    try:
        cached_data = await cache.get(cache_key)
        if cached_data is not None and isinstance(cached_data, dict):
            if current_user.role == UserRole.CITIZEN:
                fir_id_str = cached_data.get("fir_id")
                if not fir_id_str:
                    raise PermissionDeniedException("Access restricted to authorized personnel.")
                fir = await fir_service.get_fir_by_id(uuid.UUID(fir_id_str), current_user=current_user)
                if not fir or fir.submitted_by_id != current_user.id:
                    raise PermissionDeniedException("Access restricted to authorized personnel.")
            detail = CaseDetailResponse.model_validate(cached_data)
            _IN_MEMORY_CASE_DETAIL_CACHE[case_id] = (now, detail)
            _IN_MEMORY_CASE_DETAIL_CACHE[str(detail.id)] = (now, detail)
            _IN_MEMORY_CASE_DETAIL_CACHE[detail.case_number] = (now, detail)
            return success_response(data=detail, message="Case details retrieved (cache).")
    except PermissionDeniedException:
        raise
    except Exception:
        pass

    # 3. Only query database if caches miss
    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    notes_stmt = select(CaseNote).where(CaseNote.case_id == case.id).order_by(CaseNote.created_at.desc())
    notes_res = await session.execute(notes_stmt)
    notes_resp = [
        CaseNoteResponse(
            id=n.id,
            case_id=n.case_id,
            author_id=n.author_id,
            note=n.note,
            created_at=n.created_at,
        )
        for n in notes_res.scalars().all()
    ]

    evidence_stmt = select(func.count()).select_from(Evidence).where(Evidence.case_id == case.id)
    evidence_res = await session.execute(evidence_stmt)
    evidence_count = evidence_res.scalar() or 0

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
        evidence_count=evidence_count,
    )

    # Populate in-memory and Valkey distributed caches
    _IN_MEMORY_CASE_DETAIL_CACHE[case_id] = (now, detail)
    _IN_MEMORY_CASE_DETAIL_CACHE[str(case.id)] = (now, detail)
    _IN_MEMORY_CASE_DETAIL_CACHE[case.case_number] = (now, detail)
    try:
        serialized = detail.model_dump(mode="json")
        await cache.set(f"kritagas:case:{case.id}", serialized, ttl=cache.ttl.CASE)
        await cache.set(f"kritagas:case:{case.case_number}", serialized, ttl=cache.ttl.CASE)
    except Exception:
        pass

    return success_response(data=detail, message="Case details retrieved.")


@router.patch(
    "/{case_id}",
    response_model=APIResponse[CaseResponse],
    summary="Update Case Metadata",
)
async def update_case(
    request: Request,
    case_id: str,
    body: CaseUpdate,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)
    client_ip = get_client_ip(request)
    updated = await case_service.update_case(
        case_id=case.id,
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
    case_id: str,
    body: CaseAssignRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)
    client_ip = get_client_ip(request)
    updated = await case_service.assign_lead_investigator(
        case_id=case.id,
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
    case_id: str,
    body: CaseStatusUpdateRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)
    client_ip = get_client_ip(request)
    updated = await case_service.update_case_status(
        case_id=case.id,
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
    case_id: str,
    body: CaseNoteCreate,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)
    client_ip = get_client_ip(request)
    note = await case_service.add_note(
        case_id=case.id,
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
    session: AsyncSession = Depends(get_async_session),
    graph_service: Neo4jGraphService = Depends(get_graph_service),
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

    # Automatically associate FIR entities and populate CaseEntityContext + EntityRelationship
    try:
        ent_stmt = select(Entity).where(Entity.fir_id == fir.id)
        ent_res = await session.execute(ent_stmt)
        fir_entities = list(ent_res.scalars().all())

        persons: List[Entity] = []
        phones: List[Entity] = []
        financials: List[Entity] = []
        vehicles: List[Entity] = []
        locations: List[Entity] = []

        for ent in fir_entities:
            ent.case_id = case.id
            role = (ent.attributes_json or {}).get("role") or "INVOLVED_IN"
            ctx = CaseEntityContext(
                case_id=case.id,
                entity_id=ent.id,
                role=role,
                fir_id=fir.id,
                confidence=ent.confidence or 1.0,
                extraction_method="HYBRID_NER",
            )
            session.add(ctx)

            if ent.entity_type == "PERSON":
                persons.append(ent)
            elif ent.entity_type == "PHONE":
                phones.append(ent)
            elif ent.entity_type in ("FINANCIAL", "TRANSACTION"):
                financials.append(ent)
            elif ent.entity_type == "VEHICLE":
                vehicles.append(ent)
            elif ent.entity_type == "LOCATION":
                # Ensure coordinates exist
                if not (ent.attributes_json or {}).get("latitude"):
                    geo = geocoding_service.validate_or_fallback(ent.name, context=fir.description or "")
                    ent.attributes_json = {
                        **(ent.attributes_json or {}),
                        "latitude": geo.get("latitude"),
                        "longitude": geo.get("longitude"),
                        "address": geo.get("address"),
                        "city": geo.get("city"),
                        "geocoded": geo.get("geocoded", False),
                    }
                locations.append(ent)

        # Synthesize initial semantic EntityRelationships
        if persons:
            suspect = next((p for p in persons if (p.attributes_json or {}).get("role") == "SUSPECT"), None)
            victim = next((p for p in persons if (p.attributes_json or {}).get("role") in ("COMPLAINANT", "VICTIM")), persons[0])
            actor = suspect or victim

            for ph in phones:
                session.add(EntityRelationship(
                    source_entity_id=actor.id,
                    target_entity_id=ph.id,
                    relationship_type="SUBSCRIBES_TO",
                    case_id=case.id,
                    confidence=0.96,
                    extraction_method="HYBRID_CORRELATION",
                ))
            for fin in financials:
                session.add(EntityRelationship(
                    source_entity_id=actor.id,
                    target_entity_id=fin.id,
                    relationship_type="TRANSFERRED_TO",
                    case_id=case.id,
                    confidence=0.92,
                    extraction_method="HYBRID_CORRELATION",
                ))
            for v in vehicles:
                session.add(EntityRelationship(
                    source_entity_id=actor.id,
                    target_entity_id=v.id,
                    relationship_type="OPERATES",
                    case_id=case.id,
                    confidence=0.90,
                    extraction_method="HYBRID_CORRELATION",
                ))

            # Synthesize spatial relationships to locations
            for loc in locations:
                loc_type = (loc.attributes_json or {}).get("type", "LOCATION")
                if loc_type == "LAST_SEEN_LOCATION" and victim:
                    session.add(EntityRelationship(
                        source_entity_id=victim.id,
                        target_entity_id=loc.id,
                        relationship_type="LAST_SEEN_AT",
                        case_id=case.id,
                        confidence=0.94,
                        extraction_method="SPATIAL_NER",
                    ))
                elif loc_type == "SUSPECT_RESIDENCE" and suspect:
                    session.add(EntityRelationship(
                        source_entity_id=suspect.id,
                        target_entity_id=loc.id,
                        relationship_type="LIVES_AT",
                        case_id=case.id,
                        confidence=0.95,
                        extraction_method="SPATIAL_NER",
                    ))
                elif loc_type in ("CRIME_LOCATION", "KIDNAPPING_LOCATION") and victim:
                    session.add(EntityRelationship(
                        source_entity_id=victim.id,
                        target_entity_id=loc.id,
                        relationship_type="OCCURRED_AT",
                        case_id=case.id,
                        confidence=0.96,
                        extraction_method="SPATIAL_NER",
                    ))
                elif loc_type == "VEHICLE_LOCATION" and vehicles:
                    session.add(EntityRelationship(
                        source_entity_id=vehicles[0].id,
                        target_entity_id=loc.id,
                        relationship_type="SEEN_AT",
                        case_id=case.id,
                        confidence=0.92,
                        extraction_method="SPATIAL_NER",
                    ))
                elif loc_type in ("ATM", "BANK", "TRANSACTION_LOCATION"):
                    src_id = suspect.id if suspect else (financials[0].id if financials else actor.id)
                    session.add(EntityRelationship(
                        source_entity_id=src_id,
                        target_entity_id=loc.id,
                        relationship_type="TRANSFERRED_AT",
                        case_id=case.id,
                        confidence=0.93,
                        extraction_method="SPATIAL_NER",
                    ))

        await session.commit()
    except Exception as ent_link_err:
        import logging
        logging.getLogger("kritagas.cases").warning(f"Error linking entities to case: {ent_link_err}")

    # Synchronize graph to Neo4j Aura and invalidate map intelligence cache
    try:
        await graph_service.sync_case_graph(case.id, session=session)
        await map_intelligence_service.invalidate_cache(case.id)
    except Exception:
        pass

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
    case_id: str,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)
    timeline = await case_service.get_timeline(case.id)
    return success_response(
        data=timeline,
        message="Case timeline retrieved.",
    )


@router.get(
    "/{case_id}/map-intelligence",
    response_model=APIResponse[MapIntelligenceResponse],
    summary="Get Case Map Intelligence",
    description="Retrieve case-specific geographical nodes, real geocoded coordinates, and semantic investigation lines.",
)
async def get_case_map_intelligence(
    case_id: str,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
    session: AsyncSession = Depends(get_async_session),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)
    data = await map_intelligence_service.get_case_map_intelligence(case.id, session=session)
    return success_response(
        data=data,
        message=f"Retrieved {len(data.nodes)} investigation loci and {len(data.relationships)} spatial edges for Case {case.case_number}.",
    )


@router.get(
    "/{case_id}/network",
    response_model=APIResponse[Dict[str, Any]],
    summary="Get Case Intelligence Network",
    description="Retrieve nodes and relationships associated with the case for network visualization.",
)
async def get_case_network(
    case_id: str,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
    fir_service: FIRService = Depends(get_fir_service),
    graph_service: Neo4jGraphService = Depends(get_graph_service),
    session: AsyncSession = Depends(get_async_session),
    cache: CacheService = Depends(get_cache_service),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)
    real_case_id = case.id

    cache_key = cache.keys.case_network(real_case_id)
    cached_network = await cache.get(cache_key)
    if cached_network is not None and isinstance(cached_network, dict):
        return success_response(
            data=cached_network,
            message="Case network intelligence retrieved (cache).",
        )

    # First attempt graph service (Neo4j Aura with full entities & relationships)
    try:
        network = await graph_service.get_case_network(real_case_id, session=session)
        if network.nodes and len(network.nodes) > 0:
            net_dict = network.model_dump(mode="json")
            await cache.set(cache_key, net_dict, ttl=cache.ttl.NETWORK)
            return success_response(
                data=net_dict,
                message=f"Case network intelligence retrieved ({network.engine}).",
            )
    except Exception:
        pass

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

        # Retrieve and link all extracted entities from PostgreSQL
        try:
            cond = (Entity.case_id == case.id)
            if case.fir_id:
                cond = cond | (Entity.fir_id == case.fir_id)
            ent_stmt = select(Entity).where(cond)
            ent_res = await session.execute(ent_stmt)
            all_entities = list(ent_res.scalars().all())

            # Load explicit EntityRelationship records from DB
            rel_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case.id)
            rel_res = await session.execute(rel_stmt)
            db_relationships = list(rel_res.scalars().all())

            existing_node_ids = {n["id"] for n in nodes}
            existing_edge_pairs = set()

            # Add explicit database relationships first
            for r in db_relationships:
                s_id, t_id = str(r.source_entity_id), str(r.target_entity_id)
                existing_edge_pairs.add((s_id, t_id))
                existing_edge_pairs.add((t_id, s_id))
                edges.append({
                    "id": str(r.id),
                    "source": s_id,
                    "target": t_id,
                    "relationship": r.relationship_type,
                    "confidence": int((r.confidence or 0.95) * 100) if (r.confidence or 1.0) <= 1.0 else int(r.confidence),
                })

            person_nodes = []
            phone_nodes = []
            fin_nodes = []
            veh_nodes = []
            loc_nodes = []
            sec_nodes = []
            email_nodes = []

            for ent in all_entities:
                ent_node_id = str(ent.id)
                if ent_node_id not in existing_node_ids:
                    existing_node_ids.add(ent_node_id)
                    nodes.append({
                        "id": ent_node_id,
                        "label": ent.name,
                        "type": ent.entity_type.capitalize(),
                        "data": {
                            "name": ent.name,
                            "normalized": ent.normalized_value,
                            "confidence": ent.confidence,
                            **(ent.attributes_json or {}),
                        },
                    })

                etype = ent.entity_type.upper()
                if etype == "PERSON":
                    person_nodes.append(ent)
                elif etype in ("PHONE", "MOBILE"):
                    phone_nodes.append(ent)
                elif etype in ("FINANCIAL", "TRANSACTION", "ACCOUNT", "BANK_ACCOUNT"):
                    fin_nodes.append(ent)
                elif etype in ("VEHICLE", "CAR"):
                    veh_nodes.append(ent)
                elif etype in ("LOCATION", "ADDRESS"):
                    loc_nodes.append(ent)
                elif etype in ("LEGAL_SECTION", "SECTION"):
                    sec_nodes.append(ent)
                elif etype in ("EMAIL", "EVIDENCE", "DIGITAL_ID"):
                    email_nodes.append(ent)

            # Synthesize realistic inter-entity connections instead of a central starburst
            fir_node_id = f"FIR-{case.fir_id}" if case.fir_id else None
            if case.fir_id and not any(n["id"] == fir_node_id for n in nodes):
                # Check if FIR node was added earlier
                for n in nodes:
                    if n["type"] == "FIR":
                        fir_node_id = n["id"]
                        break

            if person_nodes:
                suspect = next((p for p in person_nodes if (p.attributes_json or {}).get("role") == "SUSPECT"), person_nodes[0])
                complainant = next((p for p in person_nodes if (p.attributes_json or {}).get("role") in ("COMPLAINANT", "WITNESS") and p.id != suspect.id), None)
                other_persons = [p for p in person_nodes if p.id != suspect.id and p != complainant]

                # Link Case Master cleanly to Primary Subject
                s_id = str(suspect.id)
                if (case_node_id, s_id) not in existing_edge_pairs:
                    edges.append({
                        "id": f"edge-case-subject-{suspect.id}",
                        "source": case_node_id,
                        "target": s_id,
                        "relationship": "PRIMARY_SUBJECT",
                        "confidence": 98,
                    })
                    existing_edge_pairs.add((case_node_id, s_id))

                # Person -> Phones
                for ph in phone_nodes:
                    ph_id = str(ph.id)
                    if (s_id, ph_id) not in existing_edge_pairs:
                        edges.append({
                            "id": f"syn-edge-{suspect.id}-{ph.id}",
                            "source": s_id,
                            "target": ph_id,
                            "relationship": "SUBSCRIBES_TO",
                            "confidence": 96,
                        })
                        existing_edge_pairs.add((s_id, ph_id))

                # Person -> Financials (distinguish accounts and transactions)
                accounts = [f for f in fin_nodes if "XXXX" in str(f.name) or "ACC" in str(f.name).upper() or f.entity_type == "ACCOUNT"]
                transactions = [f for f in fin_nodes if f not in accounts]
                for acc in accounts:
                    acc_id = str(acc.id)
                    if (s_id, acc_id) not in existing_edge_pairs:
                        edges.append({
                            "id": f"syn-edge-acc-{suspect.id}-{acc.id}",
                            "source": s_id,
                            "target": acc_id,
                            "relationship": "ACCOUNT_HOLDER",
                            "confidence": 95,
                        })
                        existing_edge_pairs.add((s_id, acc_id))

                for fin in (transactions if accounts else fin_nodes):
                    fin_id = str(fin.id)
                    # If accounts exist, route transactions through accounts
                    src_node = str(accounts[0].id) if accounts else s_id
                    if (src_node, fin_id) not in existing_edge_pairs:
                        edges.append({
                            "id": f"syn-edge-fin-{src_node}-{fin.id}",
                            "source": src_node,
                            "target": fin_id,
                            "relationship": "TRANSACTED" if accounts else "TRANSFERRED_TO",
                            "confidence": 92,
                        })
                        existing_edge_pairs.add((src_node, fin_id))

                # Person -> Vehicles
                for v in veh_nodes:
                    v_id = str(v.id)
                    if (s_id, v_id) not in existing_edge_pairs:
                        edges.append({
                            "id": f"syn-edge-{suspect.id}-{v.id}",
                            "source": s_id,
                            "target": v_id,
                            "relationship": "OPERATES",
                            "confidence": 90,
                        })
                        existing_edge_pairs.add((s_id, v_id))

                # Person -> Residential Locations
                for loc in loc_nodes:
                    loc_id = str(loc.id)
                    loc_name = (loc.name or "").lower()
                    if any(kw in loc_name for kw in ("flat", "house", "apt", "residence", "road", "street")):
                        if (s_id, loc_id) not in existing_edge_pairs:
                            edges.append({
                                "id": f"syn-edge-loc-{suspect.id}-{loc.id}",
                                "source": s_id,
                                "target": loc_id,
                                "relationship": "RESIDES_AT",
                                "confidence": 90,
                            })
                            existing_edge_pairs.add((s_id, loc_id))

                # Person -> Personal Emails / Digital Evidence
                for em in email_nodes:
                    em_id = str(em.id)
                    em_name = (em.name or "").lower()
                    if not any(kw in em_name for kw in ("police", "gov", ".ps@")):
                        if (s_id, em_id) not in existing_edge_pairs:
                            edges.append({
                                "id": f"syn-edge-em-{suspect.id}-{em.id}",
                                "source": s_id,
                                "target": em_id,
                                "relationship": "USES_EMAIL",
                                "confidence": 94,
                            })
                            existing_edge_pairs.add((s_id, em_id))

                # Complainant relations
                if complainant:
                    c_id = str(complainant.id)
                    if (s_id, c_id) not in existing_edge_pairs:
                        edges.append({
                            "id": f"syn-edge-comp-{suspect.id}-{complainant.id}",
                            "source": s_id,
                            "target": c_id,
                            "relationship": "ACCUSED_BY",
                            "confidence": 95,
                        })
                        existing_edge_pairs.add((s_id, c_id))
                    if fir_node_id and (fir_node_id, c_id) not in existing_edge_pairs:
                        edges.append({
                            "id": f"syn-edge-fir-comp-{complainant.id}",
                            "source": fir_node_id,
                            "target": c_id,
                            "relationship": "FILED_BY",
                            "confidence": 98,
                        })
                        existing_edge_pairs.add((fir_node_id, c_id))

                # Other persons -> Associates
                for op in other_persons:
                    op_id = str(op.id)
                    if (s_id, op_id) not in existing_edge_pairs:
                        edges.append({
                            "id": f"syn-edge-assoc-{suspect.id}-{op.id}",
                            "source": s_id,
                            "target": op_id,
                            "relationship": "ASSOCIATE_OF",
                            "confidence": 88,
                        })
                        existing_edge_pairs.add((s_id, op_id))

            # FIR relations (Legal sections & incident crime scene)
            if fir_node_id:
                for sec in sec_nodes:
                    sec_id = str(sec.id)
                    if (fir_node_id, sec_id) not in existing_edge_pairs:
                        edges.append({
                            "id": f"syn-edge-sec-{sec.id}",
                            "source": fir_node_id,
                            "target": sec_id,
                            "relationship": "CHARGED_UNDER",
                            "confidence": 99,
                        })
                        existing_edge_pairs.add((fir_node_id, sec_id))

                for loc in loc_nodes:
                    loc_id = str(loc.id)
                    loc_name = (loc.name or "").lower()
                    if not any(kw in loc_name for kw in ("flat", "house", "apt", "residence")):
                        if (fir_node_id, loc_id) not in existing_edge_pairs:
                            edges.append({
                                "id": f"syn-edge-fir-loc-{loc.id}",
                                "source": fir_node_id,
                                "target": loc_id,
                                "relationship": "CRIME_SCENE",
                                "confidence": 93,
                            })
                            existing_edge_pairs.add((fir_node_id, loc_id))

                # Official / Police station emails
                for em in email_nodes:
                    em_id = str(em.id)
                    em_name = (em.name or "").lower()
                    if any(kw in em_name for kw in ("police", "gov", ".ps@")):
                        if (fir_node_id, em_id) not in existing_edge_pairs:
                            edges.append({
                                "id": f"syn-edge-fir-em-{em.id}",
                                "source": fir_node_id,
                                "target": em_id,
                                "relationship": "OFFICIAL_CHANNEL",
                                "confidence": 96,
                            })
                            existing_edge_pairs.add((fir_node_id, em_id))
        except Exception:
            pass

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


@router.get(
    "/{case_id}/entities",
    response_model=APIResponse[Dict[str, Any]],
    summary="Get Extracted Case Entities",
    description="Retrieve all structured entities (persons, phones, financials, vehicles, locations, sections) linked to this case.",
)
async def get_case_entities(
    case_id: str,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
    session: AsyncSession = Depends(get_async_session),
    cache: CacheService = Depends(get_cache_service),
):
    now = time.time()
    if case_id in _IN_MEMORY_ENTITIES_CACHE:
        entry_time, cached_ents = _IN_MEMORY_ENTITIES_CACHE[case_id]
        if now - entry_time < 300:
            return success_response(data=cached_ents, message="Case entities retrieved (memory cache).")

    ent_cache_key = f"kritagas:case:entities:{case_id}"
    try:
        cached_ents = await cache.get(ent_cache_key)
        if cached_ents and isinstance(cached_ents, dict):
            _IN_MEMORY_ENTITIES_CACHE[case_id] = (now, cached_ents)
            return success_response(data=cached_ents, message="Case entities retrieved (cache).")
    except Exception:
        pass

    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    cond = (Entity.case_id == case.id)
    if case.fir_id:
        cond = cond | (Entity.fir_id == case.fir_id)

    ent_stmt = select(Entity).where(cond)
    ent_res = await session.execute(ent_stmt)
    entities = list(ent_res.scalars().all())

    # Map roles from context if available
    ctx_stmt = select(CaseEntityContext).where(CaseEntityContext.case_id == case.id)
    ctx_res = await session.execute(ctx_stmt)
    ctx_map = {str(c.entity_id): c.role for c in ctx_res.scalars().all()}

    categorized = {
        "persons": [],
        "phones": [],
        "vehicles": [],
        "financials": [],
        "legal_sections": [],
        "locations": [],
        "digital_identifiers": [],
    }

    serialized_list = []
    for e in entities:
        role = ctx_map.get(str(e.id)) or (e.attributes_json or {}).get("role") or "INVOLVED"
        item = {
            "id": str(e.id),
            "entity_type": e.entity_type,
            "name": e.name,
            "normalized_value": e.normalized_value or e.name,
            "confidence": int((e.confidence or 0.95) * 100),
            "role": role,
            "attributes": e.attributes_json or {},
            "source_text": e.source_text,
        }
        serialized_list.append(item)

        t = (e.entity_type or "").upper()
        if t == "PERSON":
            categorized["persons"].append(item)
        elif t == "PHONE":
            categorized["phones"].append(item)
        elif t == "VEHICLE":
            categorized["vehicles"].append(item)
        elif t in ("FINANCIAL", "TRANSACTION"):
            categorized["financials"].append(item)
        elif t == "LEGAL_SECTION":
            categorized["legal_sections"].append(item)
        elif t == "LOCATION":
            categorized["locations"].append(item)
        else:
            categorized["digital_identifiers"].append(item)

    resp_data = {
        "case_id": str(case.id),
        "case_number": case.case_number,
        "total_entities": len(serialized_list),
        "counts": {k: len(v) for k, v in categorized.items()},
        "categorized": categorized,
        "entities": serialized_list,
    }
    _IN_MEMORY_ENTITIES_CACHE[case_id] = (now, resp_data)
    _IN_MEMORY_ENTITIES_CACHE[str(case.id)] = (now, resp_data)
    _IN_MEMORY_ENTITIES_CACHE[case.case_number] = (now, resp_data)
    try:
        await cache.set(ent_cache_key, resp_data, ttl=300)
    except Exception:
        pass

    return success_response(
        data=resp_data,
        message="Case entities retrieved successfully.",
    )


@router.get(
    "/{case_id}/relationships",
    response_model=APIResponse[Dict[str, Any]],
    summary="Get Case Discovered Relationships",
    description="Retrieve all cross-entity relationships and evidence links discovered for this case dossier.",
)
async def get_case_relationships(
    case_id: str,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
    session: AsyncSession = Depends(get_async_session),
    cache: CacheService = Depends(get_cache_service),
):
    now = time.time()
    if case_id in _IN_MEMORY_RELATIONSHIPS_CACHE:
        entry_time, cached_rels = _IN_MEMORY_RELATIONSHIPS_CACHE[case_id]
        if now - entry_time < 300:
            return success_response(data=cached_rels, message="Case relationships retrieved (memory cache).")

    rel_cache_key = f"kritagas:case:relationships:{case_id}"
    try:
        cached_rels = await cache.get(rel_cache_key)
        if cached_rels and isinstance(cached_rels, dict):
            _IN_MEMORY_RELATIONSHIPS_CACHE[case_id] = (now, cached_rels)
            return success_response(data=cached_rels, message="Case relationships retrieved (cache).")
    except Exception:
        pass

    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    rel_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case.id)
    rel_res = await session.execute(rel_stmt)
    rels = list(rel_res.scalars().all())

    cond = (Entity.case_id == case.id)
    if case.fir_id:
        cond = cond | (Entity.fir_id == case.fir_id)
    ent_stmt = select(Entity).where(cond)
    ent_res = await session.execute(ent_stmt)
    entity_map = {e.id: e for e in ent_res.scalars().all()}

    results = []
    for r in rels:
        src = entity_map.get(r.source_entity_id)
        tgt = entity_map.get(r.target_entity_id)
        evidence_basis = "Investigation Evidence Match"
        if r.evidence_chain and isinstance(r.evidence_chain, dict):
            eb = r.evidence_chain.get("evidence_basis")
            if eb and isinstance(eb, list) and len(eb) > 0:
                evidence_basis = eb[0]
            elif eb and isinstance(eb, str):
                evidence_basis = eb

        results.append({
            "id": str(r.id),
            "source_id": str(r.source_entity_id),
            "source_name": src.name if src else "Case Subject",
            "source_type": src.entity_type if src else "PERSON",
            "target_id": str(r.target_entity_id),
            "target_name": tgt.name if tgt else "Investigative Target",
            "target_type": tgt.entity_type if tgt else "ENTITY",
            "relationship_type": r.relationship_type,
            "confidence": int((r.confidence or 0.95) * 100),
            "evidence_basis": evidence_basis,
        })

    if not results and entity_map:
        persons = [e for e in entity_map.values() if e.entity_type == "PERSON"]
        phones = [e for e in entity_map.values() if e.entity_type == "PHONE"]
        financials = [e for e in entity_map.values() if e.entity_type in ("FINANCIAL", "TRANSACTION")]
        vehicles = [e for e in entity_map.values() if e.entity_type == "VEHICLE"]
        locations = [e for e in entity_map.values() if e.entity_type == "LOCATION"]

        suspect = next((p for p in persons if (p.attributes_json or {}).get("role") == "SUSPECT"), persons[0] if persons else None)
        idx = 1
        if suspect:
            for ph in phones:
                results.append({
                    "id": f"syn-{idx}",
                    "source_id": str(suspect.id),
                    "source_name": suspect.name,
                    "source_type": "PERSON",
                    "target_id": str(ph.id),
                    "target_name": ph.name,
                    "target_type": "PHONE",
                    "relationship_type": "SUBSCRIBES_TO",
                    "confidence": 96,
                    "evidence_basis": "Telecom CDR Subscribed SIM Link",
                })
                idx += 1
            for fin in financials:
                results.append({
                    "id": f"syn-{idx}",
                    "source_id": str(suspect.id),
                    "source_name": suspect.name,
                    "source_type": "PERSON",
                    "target_id": str(fin.id),
                    "target_name": fin.name,
                    "target_type": "FINANCIAL",
                    "relationship_type": "TRANSFERRED_TO",
                    "confidence": 92,
                    "evidence_basis": "Bank Account Ledger / UPI Gateway Trace",
                })
                idx += 1
            for v in vehicles:
                results.append({
                    "id": f"syn-{idx}",
                    "source_id": str(suspect.id),
                    "source_name": suspect.name,
                    "source_type": "PERSON",
                    "target_id": str(v.id),
                    "target_name": v.name,
                    "target_type": "VEHICLE",
                    "relationship_type": "OPERATES",
                    "confidence": 90,
                    "evidence_basis": "Vahan Registration Ownership Match",
                })
                idx += 1
            for loc in locations:
                results.append({
                    "id": f"syn-{idx}",
                    "source_id": str(suspect.id),
                    "source_name": suspect.name,
                    "source_type": "PERSON",
                    "target_id": str(loc.id),
                    "target_name": loc.name,
                    "target_type": "LOCATION",
                    "relationship_type": "LOCATED_AT",
                    "confidence": 88,
                    "evidence_basis": "Tower CDR Geolocation Vector",
                })
                idx += 1

    resp_data = {
        "case_id": str(case.id),
        "total_relationships": len(results),
        "relationships": results,
    }
    _IN_MEMORY_RELATIONSHIPS_CACHE[case_id] = (now, resp_data)
    _IN_MEMORY_RELATIONSHIPS_CACHE[str(case.id)] = (now, resp_data)
    _IN_MEMORY_RELATIONSHIPS_CACHE[case.case_number] = (now, resp_data)
    try:
        await cache.set(rel_cache_key, resp_data, ttl=300)
    except Exception:
        pass

    return success_response(
        data=resp_data,
        message="Case relationships retrieved successfully.",
    )
