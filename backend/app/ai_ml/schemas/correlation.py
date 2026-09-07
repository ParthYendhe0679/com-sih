"""Pydantic schemas for cross-source data correlation chains and relationship discovery."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CorrelationEvidenceHop(BaseModel):
    """Single step in a cross-source correlation path (e.g., FIR -> CDR -> Bank)."""
    source: str
    relation: str
    target: str
    evidence_type: str
    document_ref: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)


class CorrelationItem(BaseModel):
    """Full multi-hop correlation result connecting investigation entities."""
    id: uuid.UUID
    case_id: uuid.UUID
    correlation_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    description: str
    source_entity_name: Optional[str] = None
    target_entity_name: Optional[str] = None
    evidence_chain: List[CorrelationEvidenceHop] = Field(default_factory=list)
    source_records: List[str] = Field(default_factory=list)
    created_at: datetime

    class Config:
        from_attributes = True


class DiscoveredRelationshipItem(BaseModel):
    """Discovered relationship between two investigation entities."""
    source_id: str
    source_name: str
    source_type: str
    relationship: str
    target_id: str
    target_name: str
    target_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_basis: List[str] = Field(default_factory=list)
    source_records: List[str] = Field(default_factory=list)
