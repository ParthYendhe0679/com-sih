"""Pydantic schemas for Entity Resolution review, matching, and de-duplication."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class EntityItem(BaseModel):
    """Investigation entity description."""
    id: uuid.UUID
    case_id: Optional[uuid.UUID] = None
    fir_id: Optional[uuid.UUID] = None
    entity_type: str
    name: str
    normalized_value: str
    confidence: float
    is_canonical: bool
    attributes: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class EntityMatchCandidate(BaseModel):
    """Candidate match between two entities requiring investigator review."""
    match_id: uuid.UUID
    source_entity: EntityItem
    target_entity: EntityItem
    confidence_score: float = Field(ge=0.0, le=1.0)
    status: str
    similarity_breakdown: Dict[str, float]
    supporting_evidence: List[str]
    conflicting_evidence: List[str]
    created_at: datetime


class EntityResolveRequest(BaseModel):
    """Investigator action to confirm or reject an entity match."""
    match_id: uuid.UUID
    decision: str = Field(description="CONFIRMED_SAME, REJECTED, or FLAGGED")
    notes: Optional[str] = None


class EntityResolveResponse(BaseModel):
    """Result of entity resolution decision."""
    match_id: uuid.UUID
    status: str
    canonical_entity_id: Optional[uuid.UUID] = None
    message: str
