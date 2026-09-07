"""Evidence metadata management and chain of custody domain service."""

from typing import Optional, Sequence
import uuid
from app.core.constants import AuditAction, EvidenceStatus, UserRole
from app.core.exceptions import (
    BadRequestException,
    PermissionDeniedException,
    ResourceNotFoundException,
)
from app.integrations.storage.storage_interface import StorageService
from app.models.evidence import Evidence
from app.models.user import User
from app.repositories.case_repository import CaseRepository
from app.repositories.evidence_repository import EvidenceRepository
from app.repositories.fir_repository import FIRRepository
from app.schemas.evidence import EvidenceCreate
from app.services.audit_service import AuditService


class EvidenceService:
    """Service governing evidence metadata, integrity recording, and storage linkage."""

    def __init__(
        self,
        evidence_repo: EvidenceRepository,
        fir_repo: FIRRepository,
        case_repo: CaseRepository,
        audit_service: AuditService,
        storage_service: StorageService,
    ):
        self.evidence_repo = evidence_repo
        self.fir_repo = fir_repo
        self.case_repo = case_repo
        self.audit_service = audit_service
        self.storage_service = storage_service

    async def add_evidence_metadata(
        self,
        data: EvidenceCreate,
        current_user: User,
        client_ip: Optional[str] = None,
    ) -> Evidence:
        """Register evidence metadata and associate with an FIR or Case."""
        if not data.case_id and not data.fir_id:
            raise BadRequestException("Evidence must be associated with at least a Case ID or an FIR ID.")

        # Citizen boundaries: Citizens cannot attach evidence directly to police Cases
        if data.case_id and current_user.role == UserRole.CITIZEN:
            raise PermissionDeniedException("Citizens may not attach evidence directly to investigative Cases.")

        # If attaching to FIR, verify FIR exists and ownership if citizen
        if data.fir_id:
            fir = await self.fir_repo.get_by_id(data.fir_id)
            if not fir:
                raise ResourceNotFoundException("FIR", data.fir_id)
            if current_user.role == UserRole.CITIZEN and fir.submitted_by_id != current_user.id:
                raise PermissionDeniedException("You cannot attach evidence to another citizen's complaint.")

        # If attaching to Case, verify Case exists
        if data.case_id:
            case = await self.case_repo.get_by_id(data.case_id)
            if not case:
                raise ResourceNotFoundException("Case", data.case_id)

        new_evidence = Evidence(
            case_id=data.case_id,
            fir_id=data.fir_id,
            title=data.title.strip(),
            description=data.description.strip() if data.description else None,
            evidence_type=data.evidence_type,
            file_name=data.file_name.strip(),
            file_url=data.file_url.strip(),
            file_hash=data.file_hash.strip() if data.file_hash else None,
            file_size=data.file_size,
            mime_type=data.mime_type,
            uploaded_by_id=current_user.id,
            metadata_json=data.metadata,
            status=EvidenceStatus.COLLECTED,
        )

        evidence = await self.evidence_repo.create(new_evidence)

        # Audit
        target_resource = "case" if evidence.case_id else "fir"
        target_id = str(evidence.case_id or evidence.fir_id)
        await self.audit_service.log_action(
            action=AuditAction.EVIDENCE_ADDED.value,
            resource_type=target_resource,
            resource_id=target_id,
            description=f"User '{current_user.username}' uploaded evidence '{evidence.title}' ({evidence.evidence_type.value})",
            user_id=current_user.id,
            new_value={"evidence_id": str(evidence.id), "file_hash": evidence.file_hash},
            ip_address=client_ip,
        )

        return evidence

    async def get_evidence_by_id(self, evidence_id: uuid.UUID, current_user: User) -> Evidence:
        """Fetch evidence item verifying access permissions."""
        evidence = await self.evidence_repo.get_by_id(evidence_id)
        if not evidence:
            raise ResourceNotFoundException("Evidence", evidence_id)

        # If citizen, verify ownership
        if current_user.role == UserRole.CITIZEN:
            if not evidence.fir_id:
                raise PermissionDeniedException("Access forbidden.")
            fir = await self.fir_repo.get_by_id(evidence.fir_id)
            if not fir or fir.submitted_by_id != current_user.id:
                raise PermissionDeniedException("Access forbidden.")

        return evidence

    async def list_by_case(
        self,
        case_id: uuid.UUID,
        current_user: User,
        page: int = 1,
        size: int = 50,
    ) -> Sequence[Evidence]:
        """Fetch all evidence items linked to a Case."""
        # Non-police/admin cannot browse case evidence
        if current_user.role == UserRole.CITIZEN:
            raise PermissionDeniedException("Access restricted to authorized personnel.")

        offset = (page - 1) * size
        return await self.evidence_repo.get_by_case_id(case_id=case_id, offset=offset, limit=size)

    async def count_by_case(self, case_id: uuid.UUID) -> int:
        """Count evidence items for a Case."""
        return await self.evidence_repo.count_by_case_id(case_id=case_id)

    async def list_by_fir(
        self,
        fir_id: uuid.UUID,
        current_user: User,
        page: int = 1,
        size: int = 50,
    ) -> Sequence[Evidence]:
        """Fetch all evidence items linked to an FIR."""
        if current_user.role == UserRole.CITIZEN:
            fir = await self.fir_repo.get_by_id(fir_id)
            if not fir or fir.submitted_by_id != current_user.id:
                raise PermissionDeniedException("Access forbidden.")

        offset = (page - 1) * size
        return await self.evidence_repo.get_by_fir_id(fir_id=fir_id, offset=offset, limit=size)

    async def count_by_fir(self, fir_id: uuid.UUID) -> int:
        """Count evidence items for an FIR."""
        return await self.evidence_repo.count_by_fir_id(fir_id=fir_id)
