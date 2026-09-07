"""Investigation audit service — blockchain-backed action audit trail."""

import uuid
from typing import Optional, Sequence

from app.blockchain.constants import InvestigationAuditAction, RecordType, EntityType
from app.blockchain.models import InvestigationAuditRecord
from app.blockchain.repository import BlockchainRepository
from app.blockchain.services.blockchain_service import BlockchainService
from app.blockchain.services.hash_service import EvidenceHashService
from app.core.logging import get_logger

logger = get_logger("kritagas.blockchain.audit")


class InvestigationAuditService:
    """Creates and verifies blockchain-backed investigation audit records."""

    def __init__(self, repo: BlockchainRepository, blockchain_service: BlockchainService):
        self.repo = repo
        self.blockchain_service = blockchain_service

    async def log_event(
        self,
        case_id: Optional[uuid.UUID],
        entity_type: str,
        entity_id: str,
        action: str,
        actor_id: Optional[uuid.UUID] = None,
        actor_role: Optional[str] = None,
        description: Optional[str] = None,
    ) -> InvestigationAuditRecord:
        """Log a blockchain-backed investigation audit event."""

        # Get previous audit record for hash chaining
        previous_hash = None
        if case_id:
            latest = await self.repo.get_latest_audit_record(case_id)
            if latest:
                previous_hash = latest.data_hash

        # Generate data hash
        audit_data = {
            "case_id": str(case_id) if case_id else "",
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "actor_id": str(actor_id) if actor_id else "",
            "previous_hash": previous_hash or "",
        }
        data_hash = EvidenceHashService.hash_json(audit_data)

        # Create record
        record = InvestigationAuditRecord(
            case_id=case_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            description=description,
            actor_id=actor_id,
            actor_role=actor_role,
            data_hash=data_hash,
            previous_hash=previous_hash,
        )

        # Register on blockchain
        bc_record = await self.blockchain_service.register_hash(
            data_hash=data_hash,
            record_type=RecordType.AUDIT_HASH.value,
            entity_type=entity_type,
            entity_id=entity_id,
            case_id=case_id,
            metadata={"action": action},
        )
        if bc_record:
            record.blockchain_record_id = bc_record.id

        record = await self.repo.create_audit_record(record)
        logger.info(f"Audit event: {action} | entity={entity_type}:{entity_id} | case={case_id}")
        return record

    async def get_case_audit_trail(
        self, case_id: uuid.UUID, limit: int = 200
    ) -> Sequence[InvestigationAuditRecord]:
        """Get the complete audit trail for a case."""
        return await self.repo.get_case_audit_trail(case_id, limit=limit)

    async def verify_audit_chain(self, case_id: uuid.UUID) -> dict:
        """Verify the hash chain integrity of a case's audit trail."""
        trail = await self.repo.get_case_audit_trail(case_id)
        if not trail:
            return {"valid": True, "total_records": 0, "broken_links": []}

        broken = []
        for i, record in enumerate(trail):
            if i == 0:
                if record.previous_hash is not None:
                    broken.append({
                        "index": i,
                        "record_id": str(record.id),
                        "issue": "First record has unexpected previous_hash",
                    })
            else:
                prev = trail[i - 1]
                if record.previous_hash != prev.data_hash:
                    broken.append({
                        "index": i,
                        "record_id": str(record.id),
                        "issue": "Hash chain broken",
                    })

        return {
            "valid": len(broken) == 0,
            "total_records": len(trail),
            "broken_links": broken,
        }

    async def count_case_audits(self, case_id: uuid.UUID) -> int:
        return await self.repo.count_case_audits(case_id)
