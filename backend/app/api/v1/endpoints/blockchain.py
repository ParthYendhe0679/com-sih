"""Blockchain evidence integrity API endpoints.

Provides REST APIs for:
- Evidence integrity verification (tamper detection)
- Chain of custody history
- Case integrity status
- Investigation audit trails
- Blockchain record lookup
- Blockchain health check
"""

import uuid
from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, require_roles
from app.blockchain.schemas import (
    AuditRecordResponse,
    BlockchainHealthResponse,
    BlockchainRecordResponse,
    CaseAuditResponse,
    CaseIntegrityResponse,
    CustodyChainResponse,
    CustodyEventResponse,
    VerificationResult,
)
from app.blockchain.services.blockchain_service import BlockchainService
from app.blockchain.services.custody_service import ChainOfCustodyService
from app.blockchain.services.integrity_service import IntegrityService
from app.blockchain.services.investigation_audit_service import InvestigationAuditService
from app.blockchain.repository import BlockchainRepository
from app.core.constants import UserRole
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.db.session import get_async_session
from app.models.user import User
from app.repositories.case_repository import CaseRepository
from app.repositories.evidence_repository import EvidenceRepository
from app.utils.response import success_response
from app.schemas.common import APIResponse

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends as FastAPIDepends

router = APIRouter()


# ── Dependency factories ─────────────────────────────────────

def _get_blockchain_repo(session: AsyncSession = Depends(get_async_session)) -> BlockchainRepository:
    return BlockchainRepository(session)


def _get_blockchain_service(repo: BlockchainRepository = Depends(_get_blockchain_repo)) -> BlockchainService:
    return BlockchainService(repo)


def _get_custody_service(
    repo: BlockchainRepository = Depends(_get_blockchain_repo),
    bc_service: BlockchainService = Depends(_get_blockchain_service),
) -> ChainOfCustodyService:
    return ChainOfCustodyService(repo, bc_service)


def _get_audit_service(
    repo: BlockchainRepository = Depends(_get_blockchain_repo),
    bc_service: BlockchainService = Depends(_get_blockchain_service),
) -> InvestigationAuditService:
    return InvestigationAuditService(repo, bc_service)


def _get_integrity_service(
    repo: BlockchainRepository = Depends(_get_blockchain_repo),
    bc_service: BlockchainService = Depends(_get_blockchain_service),
    custody_service: ChainOfCustodyService = Depends(_get_custody_service),
    audit_service: InvestigationAuditService = Depends(_get_audit_service),
) -> IntegrityService:
    return IntegrityService(repo, bc_service, custody_service, audit_service)


def _get_evidence_repo(session: AsyncSession = Depends(get_async_session)) -> EvidenceRepository:
    return EvidenceRepository(session)


def _get_case_repo(session: AsyncSession = Depends(get_async_session)) -> CaseRepository:
    return CaseRepository(session)


# ── Blockchain Health ────────────────────────────────────────

@router.get(
    "/blockchain/health",
    response_model=APIResponse[BlockchainHealthResponse],
    summary="Blockchain Provider Health Check",
    description="Check blockchain provider connectivity and operational status.",
)
async def blockchain_health(
    bc_service: BlockchainService = Depends(_get_blockchain_service),
    current_user: User = Depends(get_current_user),
):
    health = await bc_service.health_check()
    return success_response(
        data=BlockchainHealthResponse(
            provider=health.provider,
            mode=health.mode,
            status=health.status,
            block_height=health.block_height,
            details=health.details,
        ),
        message="Blockchain health status retrieved.",
    )


# ── Blockchain Record Lookup ─────────────────────────────────

@router.get(
    "/blockchain/records/{record_id}",
    response_model=APIResponse[BlockchainRecordResponse],
    summary="Get Blockchain Record",
    description="Retrieve a specific blockchain record by its ID.",
)
async def get_blockchain_record(
    record_id: uuid.UUID,
    bc_service: BlockchainService = Depends(_get_blockchain_service),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
):
    record = await bc_service.get_record(record_id)
    if not record:
        raise ResourceNotFoundException("BlockchainRecord", record_id)

    return success_response(
        data=BlockchainRecordResponse(
            id=str(record.id),
            record_type=record.record_type,
            entity_type=record.entity_type,
            entity_id=record.entity_id,
            case_id=str(record.case_id) if record.case_id else None,
            data_hash=record.data_hash,
            previous_hash=record.previous_hash,
            block_number=record.block_number,
            transaction_id=record.transaction_id,
            provider=record.provider,
            status=record.status,
            created_at=record.created_at,
            metadata_json=record.metadata_json,
        ),
        message="Blockchain record retrieved.",
    )


# ── Case Integrity ──────────────────────────────────────────

@router.get(
    "/cases/{case_id}/integrity",
    response_model=APIResponse[CaseIntegrityResponse],
    summary="Case Integrity Status",
    description="Get complete integrity verification summary for a case including all evidence records.",
)
async def get_case_integrity(
    case_id: uuid.UUID,
    integrity_service: IntegrityService = Depends(_get_integrity_service),
    case_repo: CaseRepository = Depends(_get_case_repo),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
):
    # Verify case exists
    case = await case_repo.get_by_id(case_id)
    if not case:
        raise ResourceNotFoundException("Case", case_id)

    result = await integrity_service.get_case_integrity(case_id)
    return success_response(
        data=CaseIntegrityResponse(**result),
        message="Case integrity status retrieved.",
    )


# ── Evidence Verification ───────────────────────────────────

@router.post(
    "/evidence/{evidence_id}/verify",
    response_model=APIResponse[VerificationResult],
    summary="Verify Evidence Integrity",
    description="Verify evidence integrity by comparing current hash against blockchain-registered hash. Returns VERIFIED or TAMPERED.",
)
async def verify_evidence(
    evidence_id: uuid.UUID,
    integrity_service: IntegrityService = Depends(_get_integrity_service),
    evidence_repo: EvidenceRepository = Depends(_get_evidence_repo),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
):
    evidence = await evidence_repo.get_by_id(evidence_id)
    if not evidence:
        raise ResourceNotFoundException("Evidence", evidence_id)

    result = await integrity_service.verify_evidence(evidence, current_user)
    return success_response(
        data=VerificationResult(**result),
        message=f"Evidence verification complete: {result.get('status', 'UNKNOWN')}",
    )


# ── Register Evidence Integrity (Manual Trigger) ────────────

@router.post(
    "/evidence/{evidence_id}/register-integrity",
    response_model=APIResponse[dict],
    status_code=status.HTTP_201_CREATED,
    summary="Register Evidence Integrity",
    description="Manually register evidence integrity hash on the blockchain.",
)
async def register_evidence_integrity(
    evidence_id: uuid.UUID,
    integrity_service: IntegrityService = Depends(_get_integrity_service),
    evidence_repo: EvidenceRepository = Depends(_get_evidence_repo),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
):
    evidence = await evidence_repo.get_by_id(evidence_id)
    if not evidence:
        raise ResourceNotFoundException("Evidence", evidence_id)

    record = await integrity_service.register_evidence(evidence, current_user)
    return success_response(
        data={
            "integrity_record_id": str(record.id) if record else None,
            "status": record.verification_status if record else "DISABLED",
            "hash": record.original_hash[:16] + "..." if record else None,
        },
        message="Evidence integrity registered.",
        status_code=status.HTTP_201_CREATED,
    )


# ── Chain of Custody ─────────────────────────────────────────

@router.get(
    "/evidence/{evidence_id}/chain-of-custody",
    response_model=APIResponse[CustodyChainResponse],
    summary="Evidence Chain of Custody",
    description="Get the complete chronological chain of custody for an evidence item.",
)
async def get_chain_of_custody(
    evidence_id: uuid.UUID,
    custody_service: ChainOfCustodyService = Depends(_get_custody_service),
    evidence_repo: EvidenceRepository = Depends(_get_evidence_repo),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
):
    evidence = await evidence_repo.get_by_id(evidence_id)
    if not evidence:
        raise ResourceNotFoundException("Evidence", evidence_id)

    entity_id = str(evidence_id)
    chain = await custody_service.get_chain(entity_id)
    chain_verification = await custody_service.verify_chain(entity_id)

    events = [
        CustodyEventResponse(
            id=str(e.id),
            entity_id=e.entity_id,
            event_type=e.event_type,
            description=e.description,
            performed_by_id=str(e.performed_by_id) if e.performed_by_id else None,
            previous_custodian_id=str(e.previous_custodian_id) if e.previous_custodian_id else None,
            new_custodian_id=str(e.new_custodian_id) if e.new_custodian_id else None,
            event_hash=e.event_hash,
            previous_event_hash=e.previous_event_hash,
            blockchain_record_id=str(e.blockchain_record_id) if e.blockchain_record_id else None,
            timestamp=e.timestamp,
        )
        for e in chain
    ]

    return success_response(
        data=CustodyChainResponse(
            entity_id=entity_id,
            total_events=len(events),
            chain_valid=chain_verification["valid"],
            events=events,
        ),
        message="Chain of custody retrieved.",
    )


# ── Case Audit Trail ────────────────────────────────────────

@router.get(
    "/cases/{case_id}/audit",
    response_model=APIResponse[CaseAuditResponse],
    summary="Case Investigation Audit Trail",
    description="Get the complete blockchain-backed investigation audit trail for a case.",
)
async def get_case_audit(
    case_id: uuid.UUID,
    inv_audit_service: InvestigationAuditService = Depends(_get_audit_service),
    case_repo: CaseRepository = Depends(_get_case_repo),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
):
    case = await case_repo.get_by_id(case_id)
    if not case:
        raise ResourceNotFoundException("Case", case_id)

    trail = await inv_audit_service.get_case_audit_trail(case_id)
    chain_check = await inv_audit_service.verify_audit_chain(case_id)

    records = [
        AuditRecordResponse(
            id=str(r.id),
            case_id=str(r.case_id) if r.case_id else None,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            action=r.action,
            description=r.description,
            actor_id=str(r.actor_id) if r.actor_id else None,
            actor_role=r.actor_role,
            data_hash=r.data_hash,
            previous_hash=r.previous_hash,
            blockchain_record_id=str(r.blockchain_record_id) if r.blockchain_record_id else None,
            timestamp=r.timestamp,
        )
        for r in trail
    ]

    return success_response(
        data=CaseAuditResponse(
            case_id=str(case_id),
            total_records=len(records),
            chain_valid=chain_check["valid"],
            records=records,
        ),
        message="Case audit trail retrieved.",
    )
