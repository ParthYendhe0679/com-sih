"""Blockchain compatibility event abstraction for immutable investigation audit logs."""

import hashlib
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from app.core.logging import get_logger

logger = get_logger("kritagas.blockchain_events")


class BlockchainAuditEvent:
    """Prepares structured cryptographic hashes of AI analysis milestones for future ledger immutability."""

    def __init__(
        self,
        event_type: str,
        case_id: str,
        payload: Dict[str, Any],
        actor_id: Optional[str] = None,
    ):
        self.event_type = event_type
        self.case_id = case_id
        self.payload = payload
        self.actor_id = actor_id
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.event_hash = self._compute_hash()

    def _compute_hash(self) -> str:
        data = {
            "event_type": self.event_type,
            "case_id": self.case_id,
            "payload": self.payload,
            "actor_id": self.actor_id,
            "timestamp": self.timestamp,
        }
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def emit(self) -> Dict[str, Any]:
        """Record the audit event; in future, submit transaction receipt to permissioned blockchain."""
        logger.info(
            f"[BLOCKCHAIN_AUDIT_LEDGER] Event={self.event_type} Case={self.case_id} Hash={self.event_hash[:16]}..."
        )
        return {
            "event_type": self.event_type,
            "case_id": self.case_id,
            "event_hash": self.event_hash,
            "timestamp": self.timestamp,
            "status": "RECORDED_FOR_BLOCKCHAIN_ANCHOR",
        }
