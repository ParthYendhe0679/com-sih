"""FastAPI endpoints for KRITAGAS Part 5 Centralized Data Synchronization.

Provides unified endpoints for:
- Intelligence source ingestion & integrity registration
- NLP / OCR text entity extraction & case context mapping
- Persistent entity relationships querying and discovery
- Multi-investigator CaseMember team management
- SAMANVAYA multi-agent synthesis report generation & blockchain registration
"""

import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_async_session,
    get_current_user,
    require_roles,
)
from app.core.constants import UserRole
from app.core.exceptions import NotFoundException, PermissionDeniedException
from app.models.case import Case
from app.models.data_architecture import (
    CaseEntityContext,
    CaseMember,
    DataSource,
    EntityRelationship,
    InvestigationReport,
)
from app.models.user import User
from app.services.data_synchronization_service import DataSynchronizationService
from app.utils.response import success_response

router = APIRouter()


# -------------------------------------------------------------
# Request / Response Schemas
# -------------------------------------------------------------

class IngestSourceRequest(BaseModel):
    source_type: str = Field(..., description="FIR, CALL_RECORD, FINANCIAL_RECORD, CCTV, SOCIAL_MEDIA, etc.")
    source_reference: str = Field(..., description="Document ID, filename, or batch reference")
    title: str = Field(..., description="Human readable title of evidence source")
    file_name: str = Field(..., description="Storage filename")
    file_url: str = Field(..., description="URI or path to stored file")
    fir_id: Optional[uuid.UUID] = None
    source_system: Optional[str] = "GATEWAY_INTAKE"
    raw_metadata: Optional[Dict[str, Any]] = None


class ProcessTextRequest(BaseModel):
    text: str = Field(..., min_length=5, description="Raw narrative, OCR text, or witness transcript")
    fir_id: Optional[uuid.UUID] = None
    source_evidence_id: Optional[uuid.UUID] = None
    extraction_method: str = "NLP_EXTRACTION"


class AddMemberRequest(BaseModel):
    user_id: uuid.UUID
    role: str = Field("INVESTIGATOR", description="LEAD_INVESTIGATOR, INVESTIGATOR, ANALYST, FORENSIC_EXPERT, SUPERVISOR")
    permissions: Optional[Dict[str, Any]] = None


# -------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------

@router.post(
    "/cases/{case_id}/ingest",
    summary="Ingest Intelligence Source & Register Blockchain Integrity",
    status_code=status.HTTP_201_CREATED,
)
async def ingest_case_source(
    case_id: uuid.UUID,
    payload: IngestSourceRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Atomically ingest an intelligence data source, create Evidence metadata,
    store DataSource tracking row, and register immutable cryptographic hash in BlockchainRecord.
    """
    sync_service = DataSynchronizationService(session)
    result = await sync_service.ingest_document_source(
        case_id=case_id,
        source_type=payload.source_type,
        source_reference=payload.source_reference,
        title=payload.title,
        file_name=payload.file_name,
        file_url=payload.file_url,
        uploaded_by=current_user,
        fir_id=payload.fir_id,
        source_system=payload.source_system,
        raw_metadata=payload.raw_metadata,
    )
    return success_response(
        data=result,
        message="Intelligence data source ingested and blockchain integrity registered.",
        status_code=status.HTTP_201_CREATED,
    )


@router.post(
    "/cases/{case_id}/process-text",
    summary="Extract & Synchronize Entities into Global/Case Context",
)
async def process_text_entities(
    case_id: uuid.UUID,
    payload: ProcessTextRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Extract entities from narrative text, link to canonical global entities,
    and persist case-specific role contexts in CaseEntityContext.
    """
    sync_service = DataSynchronizationService(session)
    entities = await sync_service.process_text_entities(
        case_id=case_id,
        text=payload.text,
        user=current_user,
        fir_id=payload.fir_id,
        source_evidence_id=payload.source_evidence_id,
        extraction_method=payload.extraction_method,
    )
    return success_response(
        data=entities,
        message=f"Extracted and synchronized {len(entities)} entities.",
    )


@router.get(
    "/cases/{case_id}/entities/context",
    summary="List Case Entities with Contextual Roles",
)
async def get_case_entities_context(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Fetch all entities linked to a case including their specific contextual role (Suspect, Witness, etc.)."""
    stmt = (
        select(CaseEntityContext)
        .where(CaseEntityContext.case_id == case_id)
        .order_by(CaseEntityContext.created_at.desc())
    )
    res = await session.execute(stmt)
    contexts = res.scalars().all()

    data = [
        {
            "context_id": str(c.id),
            "entity_id": str(c.entity_id),
            "entity_name": c.entity.name if c.entity else "Unknown",
            "entity_type": c.entity.entity_type if c.entity else "UNKNOWN",
            "role": c.role,
            "status": c.status,
            "confidence": c.confidence,
            "extraction_method": c.extraction_method,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in contexts
    ]
    return success_response(data=data, message="Case entity contexts retrieved.")


@router.post(
    "/cases/{case_id}/relationships/discover",
    summary="Discover & Persist Evidence-Backed Relationships",
)
async def discover_relationships(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Run relationship discovery engine across entities in a case and persist
    discovered connections to the entity_relationships table.
    """
    sync_service = DataSynchronizationService(session)
    relationships = await sync_service.discover_and_persist_relationships(
        case_id=case_id,
        user=current_user,
    )
    return success_response(
        data=relationships,
        message=f"Discovered and persisted {len(relationships)} relationships.",
    )


@router.get(
    "/cases/{case_id}/relationships",
    summary="Get Persisted Entity Relationships for Case",
)
async def get_case_relationships(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Fetch all persisted relationship graph edges for a case."""
    stmt = select(EntityRelationship).where(EntityRelationship.case_id == case_id)
    res = await session.execute(stmt)
    rels = res.scalars().all()

    data = [
        {
            "id": str(r.id),
            "source_entity_id": str(r.source_entity_id),
            "source_name": r.source_entity.name if r.source_entity else "Unknown",
            "source_type": r.source_entity.entity_type if r.source_entity else "UNKNOWN",
            "relationship_type": r.relationship_type,
            "target_entity_id": str(r.target_entity_id),
            "target_name": r.target_entity.name if r.target_entity else "Unknown",
            "target_type": r.target_entity.entity_type if r.target_entity else "UNKNOWN",
            "confidence": r.confidence,
            "status": r.status,
            "extraction_method": r.extraction_method,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rels
    ]
    return success_response(data=data, message="Case relationships retrieved.")


@router.post(
    "/cases/{case_id}/members",
    summary="Assign Team Member to Case",
    status_code=status.HTTP_201_CREATED,
)
async def add_case_member(
    case_id: uuid.UUID,
    payload: AddMemberRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Assign an officer, analyst, or forensic expert to an investigation team."""
    sync_service = DataSynchronizationService(session)
    member = await sync_service.add_case_member(
        case_id=case_id,
        user_id=payload.user_id,
        role=payload.role,
        assigned_by=current_user,
        permissions=payload.permissions,
    )
    return success_response(
        data={
            "member_id": str(member.id),
            "case_id": str(member.case_id),
            "user_id": str(member.user_id),
            "role": member.role,
            "is_active": member.is_active,
        },
        message="Team member assigned successfully.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/cases/{case_id}/members",
    summary="List Active Case Investigation Team Members",
)
async def list_case_members(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """List all active officers and specialists assigned to a case."""
    sync_service = DataSynchronizationService(session)
    members = await sync_service.list_case_members(case_id)
    data = [
        {
            "member_id": str(m.id),
            "user_id": str(m.user_id),
            "username": m.user.username if m.user else "Unknown",
            "full_name": m.user.full_name if m.user else "Unknown",
            "role": m.role,
            "assigned_at": m.assigned_at.isoformat() if m.assigned_at else None,
            "is_active": m.is_active,
        }
        for m in members
    ]
    return success_response(data=data, message="Case team members retrieved.")


@router.post(
    "/cases/{case_id}/reports/samanvaya",
    summary="Generate SAMANVAYA Report & Register on Blockchain",
    status_code=status.HTTP_201_CREATED,
)
async def generate_samanvaya_report(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Execute autonomous SAMANVAYA multi-agent investigation, synthesize unified report,
    persist in PostgreSQL, and anchor cryptographic content hash onto blockchain ledger.
    """
    sync_service = DataSynchronizationService(session)
    report = await sync_service.generate_and_persist_samanvaya_report(
        case_id=case_id,
        user=current_user,
    )
    return success_response(
        data=report,
        message="SAMANVAYA intelligence synthesis report generated and registered on blockchain.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/cases/{case_id}/reports",
    summary="List Investigation & AI Reports for Case",
)
async def list_case_reports(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Fetch all persisted official and AI investigation reports for a case."""
    stmt = (
        select(InvestigationReport)
        .where(InvestigationReport.case_id == case_id)
        .order_by(InvestigationReport.created_at.desc())
    )
    res = await session.execute(stmt)
    reports = res.scalars().all()

    data = [
        {
            "id": str(r.id),
            "report_type": r.report_type,
            "title": r.title,
            "summary": r.summary,
            "status": r.status,
            "agent_name": r.agent_name,
            "content_hash": r.content_hash,
            "has_blockchain_record": r.blockchain_record_id is not None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reports
    ]
    return success_response(data=data, message="Investigation reports retrieved.")
