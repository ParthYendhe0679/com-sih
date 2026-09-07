"""Evidence metadata request and response schemas."""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.core.constants import EvidenceStatus, EvidenceType


class EvidenceCreate(BaseModel):
    """Payload for uploading/registering evidence metadata."""
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    evidence_type: EvidenceType = EvidenceType.DOCUMENT
    file_name: str = Field(..., min_length=1, max_length=255)
    file_url: str = Field(..., min_length=1, max_length=500)
    case_id: Optional[uuid.UUID] = None
    fir_id: Optional[uuid.UUID] = None
    file_hash: Optional[str] = Field(None, max_length=64, description="SHA-256 integrity hash")
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class EvidenceResponse(BaseModel):
    """Response representation of evidence metadata."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: Optional[uuid.UUID] = None
    fir_id: Optional[uuid.UUID] = None
    title: str
    description: Optional[str] = None
    evidence_type: EvidenceType
    file_name: str
    file_url: str
    file_hash: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_by_id: uuid.UUID
    uploaded_at: datetime
    status: EvidenceStatus
    metadata_json: Optional[Dict[str, Any]] = None
