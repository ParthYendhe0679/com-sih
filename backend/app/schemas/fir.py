"""First Information Report (FIR) request and response schemas."""

import uuid
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.core.constants import DocumentProcessingStatus, FIRPriority, FIRStatus


class FIRCreate(BaseModel):
    """Payload for citizen filing of an online complaint/FIR."""
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20)
    crime_category: str = Field(..., min_length=3, max_length=100)
    incident_date: date
    incident_time: Optional[time] = None
    incident_location: str = Field(..., min_length=3, max_length=255)
    priority: FIRPriority = FIRPriority.MEDIUM


class FIRUpdate(BaseModel):
    """Payload for updating draft FIR contents."""
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=20)
    incident_location: Optional[str] = Field(None, min_length=3, max_length=255)
    priority: Optional[FIRPriority] = None


class FIRReviewRequest(BaseModel):
    """Payload for police review decision."""
    status: FIRStatus = Field(
        ...,
        description="Must be ACCEPTED, REJECTED, or MORE_INFORMATION_REQUIRED",
    )
    rejection_reason: Optional[str] = Field(None, description="Required if status is REJECTED")
    priority: Optional[FIRPriority] = None


class FIRInfoRequest(BaseModel):
    """Payload for police officer requesting more information from the citizen."""
    instructions: str = Field(..., min_length=5, description="Specific details needed from complainant")


class FIRProvideInfoRequest(BaseModel):
    """Payload for citizen responding to an information request."""
    additional_information: str = Field(..., min_length=5, description="Complainant response text")


class OfflineFIRCreate(BaseModel):
    """Payload for registering an offline physically lodged FIR complaint."""
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20)
    crime_category: str = Field(..., min_length=3, max_length=100)
    incident_date: date
    incident_time: Optional[time] = None
    incident_location: str = Field(..., min_length=3, max_length=255)
    priority: FIRPriority = FIRPriority.MEDIUM
    document_name: str = Field(..., min_length=3, max_length=255)
    document_type: str = Field(..., description="PDF, IMAGE, SCANNED_DOCUMENT")
    document_url: str = Field(..., min_length=5, max_length=500)


class FIRResponse(BaseModel):
    """Summary response representation of an FIR."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fir_number: str
    title: str
    crime_category: str
    status: FIRStatus
    priority: FIRPriority
    incident_date: date
    incident_location: str
    submitted_by_id: uuid.UUID
    reviewed_by_id: Optional[uuid.UUID] = None
    is_offline: bool
    created_at: datetime


class FIRDetailResponse(BaseModel):
    """Comprehensive detail representation of an FIR."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fir_number: str
    title: str
    description: str
    crime_category: str
    incident_date: date
    incident_time: Optional[time] = None
    incident_location: str
    status: FIRStatus
    priority: FIRPriority
    submitted_by_id: uuid.UUID
    reviewed_by_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    additional_information: Optional[List[Dict[str, Any]]] = None
    is_offline: bool
    document_name: Optional[str] = None
    document_type: Optional[str] = None
    document_url: Optional[str] = None
    processing_status: DocumentProcessingStatus
    case_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
