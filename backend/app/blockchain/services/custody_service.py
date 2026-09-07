"""Chain of custody service — tracks evidence movement and processing events."""

import uuid
from typing import Optional, Sequence

from app.blockchain.constants import CustodyEventType, RecordType, EntityType
from app.blockchain.models import ChainOfCustodyEvent
from app.blockchain.repository import BlockchainRepository
from app.blockchain.services.blockchain_service import BlockchainService
from app.blockchain.services.hash_service import EvidenceHashService
from app.core.logging import get_logger

logger = get_logger("kritagas.blockchain.custody")


class ChainOfCustodyService:
    """Manages the creation and verification of chain of custody event chains."""

    def __init__(self, repo: BlockchainRepository, blockchain_service: BlockchainService):
        self.repo = repo
        self.blockchain_service = blockchain_service

    async def create_event(
        self,
        entity_id: str,
        event_type: str,
        performed_by_id: Optional[uuid.UUID] = None,
        evidence_id: Optional[uuid.UUID] = None,
        case_id: Optional[uuid.UUID] = None,
        description: Optional[str] = None,
        previous_custodian_id: Optional[uuid.UUID] = None,
        new_custodian_id: Optional[uuid.UUID] = None,
    ) -> ChainOfCustodyEvent:
        """Create a new chain of custody event, linked to the previous event's hash."""

        # Get the latest event for this entity to chain hashes
        latest = await self.repo.get_latest_custody_event(entity_id)
        previous_event_hash = latest.event_hash if latest else None

        # Build event hash from event data
        event_data = {
            "entity_id": entity_id,
            "event_type": event_type,
            "performed_by_id": str(performed_by_id) if performed_by_id else "",
            "previous_event_hash": previous_event_hash or "",
            "description": description or "",
        }
        event_hash = EvidenceHashService.hash_json(event_data)

        # Create event
        event = ChainOfCustodyEvent(
            evidence_id=evidence_id,
            case_id=case_id,
            entity_id=entity_id,
            event_type=event_type,
            description=description,
            performed_by_id=performed_by_id,
            previous_custodian_id=previous_custodian_id,
            new_custodian_id=new_custodian_id,
            event_hash=event_hash,
            previous_event_hash=previous_event_hash,
        )

        # Register on blockchain
        bc_record = await self.blockchain_service.register_hash(
            data_hash=event_hash,
            record_type=RecordType.CUSTODY_EVENT_HASH.value,
            entity_type=EntityType.EVIDENCE.value,
            entity_id=entity_id,
            case_id=case_id,
            metadata={"event_type": event_type},
        )
        if bc_record:
            event.blockchain_record_id = bc_record.id

        event = await self.repo.create_custody_event(event)

        logger.info(
            f"Custody event created: {event_type} for entity {entity_id} | "
            f"hash={event_hash[:16]}... | chain_depth={await self.repo.count_custody_events(entity_id)}"
        )
        return event

    async def get_chain(
        self, entity_id: str, limit: int = 200
    ) -> Sequence[ChainOfCustodyEvent]:
        """Get the complete chronological custody chain for an entity."""
        return await self.repo.get_custody_chain(entity_id, limit=limit)

    async def verify_chain(self, entity_id: str) -> dict:
        """Verify the integrity of the custody chain by checking hash links.

        Returns a dict with 'valid' (bool), 'total_events' (int), and 'broken_links' (list).
        """
        chain = await self.repo.get_custody_chain(entity_id)
        if not chain:
            return {"valid": True, "total_events": 0, "broken_links": []}

        broken_links = []
        for i, event in enumerate(chain):
            if i == 0:
                # First event should have no previous hash
                if event.previous_event_hash is not None:
                    broken_links.append({
                        "event_index": i,
                        "event_id": str(event.id),
                        "issue": "First event has unexpected previous_event_hash",
                    })
            else:
                # Each subsequent event's previous_event_hash must match prior event's event_hash
                prev_event = chain[i - 1]
                if event.previous_event_hash != prev_event.event_hash:
                    broken_links.append({
                        "event_index": i,
                        "event_id": str(event.id),
                        "expected_previous_hash": prev_event.event_hash[:16] + "...",
                        "actual_previous_hash": (event.previous_event_hash or "null")[:16] + "...",
                        "issue": "Hash chain link broken",
                    })

        return {
            "valid": len(broken_links) == 0,
            "total_events": len(chain),
            "broken_links": broken_links,
        }

    async def count_events(self, entity_id: str) -> int:
        """Count custody events for an entity."""
        return await self.repo.count_custody_events(entity_id)
