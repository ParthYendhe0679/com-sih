"""Integrity service — high-level orchestrator for evidence verification and tamper detection.

This is the main entry point for all integrity operations, coordinating the
hash service, blockchain service, custody service, and audit service.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.blockchain.constants import (
    CustodyEventType,
    EntityType,
    IntegrityStatus,
    InvestigationAuditAction,
    RecordType,
)
from app.blockchain.models import EvidenceIntegrityRecord
from app.blockchain.repository import BlockchainRepository
from app.blockchain.services.blockchain_service import BlockchainService
from app.blockchain.services.custody_service import ChainOfCustodyService
from app.blockchain.services.hash_service import EvidenceHashService
from app.blockchain.services.investigation_audit_service import InvestigationAuditService
from app.core.logging import get_logger
from app.models.evidence import Evidence
from app.models.fir import FIR
from app.models.case import Case
from app.models.user import User

logger = get_logger("kritagas.blockchain.integrity")


class IntegrityService:
    """Top-level service orchestrating evidence integrity, tamper detection, and audit tracking."""

    def __init__(
        self,
        repo: BlockchainRepository,
        blockchain_service: BlockchainService,
        custody_service: ChainOfCustodyService,
        audit_service: InvestigationAuditService,
    ):
        self.repo = repo
        self.blockchain_service = blockchain_service
        self.custody_service = custody_service
        self.audit_service = audit_service

    # ── Evidence Registration ────────────────────────────────

    async def register_evidence(
        self,
        evidence: Evidence,
        user: User,
    ) -> Optional[EvidenceIntegrityRecord]:
        """Register evidence integrity: hash + blockchain + integrity record + custody event."""

        evidence_hash = EvidenceHashService.hash_evidence_metadata(
            evidence_id=str(evidence.id),
            file_hash=evidence.file_hash,
            title=evidence.title,
            evidence_type=evidence.evidence_type.value if hasattr(evidence.evidence_type, 'value') else str(evidence.evidence_type),
            file_name=evidence.file_name,
            case_id=str(evidence.case_id) if evidence.case_id else None,
            fir_id=str(evidence.fir_id) if evidence.fir_id else None,
        )

        # Register on blockchain
        bc_record = await self.blockchain_service.register_hash(
            data_hash=evidence_hash,
            record_type=RecordType.EVIDENCE_HASH.value,
            entity_type=EntityType.EVIDENCE.value,
            entity_id=str(evidence.id),
            case_id=evidence.case_id,
            metadata={"title": evidence.title, "file_hash": evidence.file_hash},
        )

        # Create integrity record
        integrity = EvidenceIntegrityRecord(
            evidence_id=evidence.id,
            case_id=evidence.case_id,
            entity_type=EntityType.EVIDENCE.value,
            entity_id=str(evidence.id),
            original_hash=evidence_hash,
            verification_status=IntegrityStatus.REGISTERED.value,
            blockchain_record_id=bc_record.id if bc_record else None,
        )
        integrity = await self.repo.create_integrity_record(integrity)

        # Create custody event
        await self.custody_service.create_event(
            entity_id=str(evidence.id),
            event_type=CustodyEventType.EVIDENCE_CREATED.value,
            performed_by_id=user.id,
            evidence_id=evidence.id,
            case_id=evidence.case_id,
            description=f"Evidence '{evidence.title}' registered with integrity hash",
        )

        # Audit trail
        await self.audit_service.log_event(
            case_id=evidence.case_id,
            entity_type=EntityType.EVIDENCE.value,
            entity_id=str(evidence.id),
            action=InvestigationAuditAction.INTEGRITY_REGISTERED.value,
            actor_id=user.id,
            actor_role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            description=f"Integrity registered for evidence '{evidence.title}'",
        )

        logger.info(f"Evidence integrity registered: {evidence.id} | hash={evidence_hash[:16]}...")
        return integrity

    # ── Evidence Verification ────────────────────────────────

    async def verify_evidence(
        self,
        evidence: Evidence,
        user: User,
    ) -> Dict[str, Any]:
        """Verify evidence integrity by comparing current hash against registered hash.

        Returns a verification result dict with status VERIFIED or TAMPERED.
        """
        entity_id = str(evidence.id)

        # Get registered integrity record
        integrity = await self.repo.get_integrity_by_evidence(evidence.id)
        if not integrity:
            return {
                "evidence_id": entity_id,
                "status": "NOT_REGISTERED",
                "message": "No integrity record found for this evidence.",
            }

        # Generate current hash
        current_hash = EvidenceHashService.hash_evidence_metadata(
            evidence_id=entity_id,
            file_hash=evidence.file_hash,
            title=evidence.title,
            evidence_type=evidence.evidence_type.value if hasattr(evidence.evidence_type, 'value') else str(evidence.evidence_type),
            file_name=evidence.file_name,
            case_id=str(evidence.case_id) if evidence.case_id else None,
            fir_id=str(evidence.fir_id) if evidence.fir_id else None,
        )

        original_hash = integrity.original_hash
        is_verified = current_hash == original_hash

        # Update integrity record
        now = datetime.now(timezone.utc)
        if is_verified:
            integrity.verification_status = IntegrityStatus.VERIFIED.value
            integrity.last_verified_at = now
            integrity.verified_by_id = user.id
            await self.repo.update_integrity_record(integrity)

            # Custody event
            await self.custody_service.create_event(
                entity_id=entity_id,
                event_type=CustodyEventType.EVIDENCE_VERIFIED.value,
                performed_by_id=user.id,
                evidence_id=evidence.id,
                case_id=evidence.case_id,
                description="Evidence integrity verified — hash match confirmed",
            )

            result = {
                "evidence_id": entity_id,
                "status": "VERIFIED",
                "original_hash": original_hash,
                "current_hash": current_hash,
                "verified_at": now.isoformat(),
                "blockchain_record_id": str(integrity.blockchain_record_id) if integrity.blockchain_record_id else None,
            }
        else:
            integrity.verification_status = IntegrityStatus.TAMPERED.value
            integrity.last_verified_at = now
            integrity.verified_by_id = user.id
            await self.repo.update_integrity_record(integrity)

            # Tamper detection events
            await self.custody_service.create_event(
                entity_id=entity_id,
                event_type=CustodyEventType.TAMPER_DETECTED.value,
                performed_by_id=user.id,
                evidence_id=evidence.id,
                case_id=evidence.case_id,
                description=f"TAMPER DETECTED — hash mismatch. Original: {original_hash[:16]}..., Current: {current_hash[:16]}...",
            )

            await self.audit_service.log_event(
                case_id=evidence.case_id,
                entity_type=EntityType.EVIDENCE.value,
                entity_id=entity_id,
                action=InvestigationAuditAction.EVIDENCE_TAMPER_DETECTED.value,
                actor_id=user.id,
                actor_role=user.role.value if hasattr(user.role, 'value') else str(user.role),
                description=f"TAMPER DETECTED for evidence '{evidence.title}'",
            )

            result = {
                "evidence_id": entity_id,
                "status": "TAMPERED",
                "original_hash": original_hash,
                "current_hash": current_hash,
                "verified_at": now.isoformat(),
                "severity": "HIGH",
                "blockchain_record_id": str(integrity.blockchain_record_id) if integrity.blockchain_record_id else None,
            }

        logger.info(f"Evidence verification: {entity_id} → {result['status']}")
        return result

    # ── FIR Registration ─────────────────────────────────────

    async def register_fir(
        self,
        fir: FIR,
        user: User,
    ) -> Optional[EvidenceIntegrityRecord]:
        """Register FIR document integrity."""
        fir_hash = EvidenceHashService.hash_fir(
            fir_id=str(fir.id),
            fir_number=fir.fir_number,
            title=fir.title,
            description=fir.description,
            crime_category=fir.crime_category,
            incident_location=fir.incident_location,
        )

        bc_record = await self.blockchain_service.register_hash(
            data_hash=fir_hash,
            record_type=RecordType.FIR_HASH.value,
            entity_type=EntityType.FIR.value,
            entity_id=str(fir.id),
            metadata={"fir_number": fir.fir_number, "title": fir.title},
        )

        integrity = EvidenceIntegrityRecord(
            case_id=None,
            entity_type=EntityType.FIR.value,
            entity_id=str(fir.id),
            original_hash=fir_hash,
            verification_status=IntegrityStatus.REGISTERED.value,
            blockchain_record_id=bc_record.id if bc_record else None,
        )
        integrity = await self.repo.create_integrity_record(integrity)

        await self.custody_service.create_event(
            entity_id=str(fir.id),
            event_type=CustodyEventType.EVIDENCE_UPLOADED.value,
            performed_by_id=user.id,
            case_id=None,
            description=f"FIR '{fir.fir_number}' integrity registered",
        )

        logger.info(f"FIR integrity registered: {fir.fir_number} | hash={fir_hash[:16]}...")
        return integrity

    # ── AI Report Registration ───────────────────────────────

    async def register_ai_report(
        self,
        case_id: uuid.UUID,
        report_type: str,
        content: str,
        user: User,
    ) -> Optional[EvidenceIntegrityRecord]:
        """Register AI-generated report integrity."""
        report_hash = EvidenceHashService.hash_ai_report(
            case_id=str(case_id),
            report_type=report_type,
            content=content,
        )

        bc_record = await self.blockchain_service.register_hash(
            data_hash=report_hash,
            record_type=RecordType.AI_REPORT_HASH.value,
            entity_type=EntityType.AI_REPORT.value,
            entity_id=f"{case_id}:{report_type}",
            case_id=case_id,
            metadata={"report_type": report_type},
        )

        integrity = EvidenceIntegrityRecord(
            case_id=case_id,
            entity_type=EntityType.AI_REPORT.value,
            entity_id=f"{case_id}:{report_type}",
            original_hash=report_hash,
            verification_status=IntegrityStatus.REGISTERED.value,
            blockchain_record_id=bc_record.id if bc_record else None,
        )
        integrity = await self.repo.create_integrity_record(integrity)

        await self.audit_service.log_event(
            case_id=case_id,
            entity_type=EntityType.AI_REPORT.value,
            entity_id=f"{case_id}:{report_type}",
            action=InvestigationAuditAction.AI_REPORT_GENERATED.value,
            actor_id=user.id,
            actor_role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            description=f"AI report '{report_type}' integrity registered",
        )

        logger.info(f"AI report integrity registered: case={case_id} type={report_type}")
        return integrity

    # ── Case Integrity Summary ───────────────────────────────

    async def get_case_integrity(self, case_id: uuid.UUID) -> Dict[str, Any]:
        """Get complete integrity status summary for a case."""
        integrity_records = await self.repo.list_integrity_by_case(case_id)
        blockchain_records = await self.repo.list_records_by_case(case_id)
        audit_count = await self.audit_service.count_case_audits(case_id)

        verified_count = sum(
            1 for r in integrity_records
            if r.verification_status == IntegrityStatus.VERIFIED.value
        )
        tampered_count = sum(
            1 for r in integrity_records
            if r.verification_status == IntegrityStatus.TAMPERED.value
        )
        registered_count = sum(
            1 for r in integrity_records
            if r.verification_status == IntegrityStatus.REGISTERED.value
        )

        overall_status = "CLEAN"
        if tampered_count > 0:
            overall_status = "TAMPERED"
        elif verified_count > 0 and registered_count == 0:
            overall_status = "FULLY_VERIFIED"
        elif len(integrity_records) == 0:
            overall_status = "NO_RECORDS"

        return {
            "case_id": str(case_id),
            "overall_status": overall_status,
            "total_integrity_records": len(integrity_records),
            "verified": verified_count,
            "tampered": tampered_count,
            "registered": registered_count,
            "blockchain_records": len(blockchain_records),
            "audit_events": audit_count,
            "records": [
                {
                    "id": str(r.id),
                    "entity_type": r.entity_type,
                    "entity_id": r.entity_id,
                    "status": r.verification_status,
                    "original_hash": r.original_hash[:16] + "...",
                    "last_verified": r.last_verified_at.isoformat() if r.last_verified_at else None,
                }
                for r in integrity_records
            ],
        }
