"""Pydantic schemas for blockchain integrity API responses."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Blockchain Health ────────────────────────────────────────

class BlockchainHealthResponse(BaseModel):
    """Response for /blockchain/health."""
    provider: str
    mode: str
    status: str
    block_height: int
    details: Optional[Dict[str, Any]] = None


# ── Blockchain Record ────────────────────────────────────────

class BlockchainRecordResponse(BaseModel):
    """Response for blockchain record details."""
    id: str
    record_type: str
    entity_type: str
    entity_id: str
    case_id: Optional[str] = None
    data_hash: str
    previous_hash: Optional[str] = None
    block_number: int
    transaction_id: str
    provider: str
    status: str
    created_at: datetime
    metadata_json: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


# ── Evidence Integrity ───────────────────────────────────────

class IntegrityRecordResponse(BaseModel):
    """Response for an evidence integrity record."""
    id: str
    entity_type: str
    entity_id: str
    evidence_id: Optional[str] = None
    case_id: Optional[str] = None
    original_hash: str
    verification_status: str
    blockchain_record_id: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Verification Result ─────────────────────────────────────

class VerificationResult(BaseModel):
    """Response for evidence verification (tamper detection)."""
    evidence_id: str
    status: str  # VERIFIED | TAMPERED | NOT_REGISTERED
    original_hash: Optional[str] = None
    current_hash: Optional[str] = None
    verified_at: Optional[str] = None
    severity: Optional[str] = None
    blockchain_record_id: Optional[str] = None
    message: Optional[str] = None


# ── Chain of Custody ─────────────────────────────────────────

class CustodyEventResponse(BaseModel):
    """Response for a single custody event."""
    id: str
    entity_id: str
    event_type: str
    description: Optional[str] = None
    performed_by_id: Optional[str] = None
    previous_custodian_id: Optional[str] = None
    new_custodian_id: Optional[str] = None
    event_hash: str
    previous_event_hash: Optional[str] = None
    blockchain_record_id: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class CustodyChainResponse(BaseModel):
    """Response for a complete custody chain."""
    entity_id: str
    total_events: int
    chain_valid: bool
    events: List[CustodyEventResponse]


# ── Case Integrity ───────────────────────────────────────────

class CaseIntegrityResponse(BaseModel):
    """Response for case-level integrity summary."""
    case_id: str
    overall_status: str
    total_integrity_records: int
    verified: int
    tampered: int
    registered: int
    blockchain_records: int
    audit_events: int
    records: List[Dict[str, Any]]


# ── Investigation Audit ─────────────────────────────────────

class AuditRecordResponse(BaseModel):
    """Response for a single investigation audit record."""
    id: str
    case_id: Optional[str] = None
    entity_type: str
    entity_id: str
    action: str
    description: Optional[str] = None
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None
    data_hash: str
    previous_hash: Optional[str] = None
    blockchain_record_id: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class CaseAuditResponse(BaseModel):
    """Response for case audit trail."""
    case_id: str
    total_records: int
    chain_valid: bool
    records: List[AuditRecordResponse]
