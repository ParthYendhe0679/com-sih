"""Case investigation request and response schemas."""

import uuid
from datetime import date, datetime, time
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.core.constants import CasePriority, CaseStatus


class CaseCreate(BaseModel):
    """Payload for creating a new criminal investigation Case."""
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20)
    crime_category: str = Field(..., min_length=3, max_length=100)
    crime_type: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    police_station: Optional[str] = None
    area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    priority: CasePriority = CasePriority.MEDIUM
    fir_id: Optional[uuid.UUID] = Field(None, description="Originating accepted FIR ID")
    lead_investigator_id: Optional[uuid.UUID] = Field(None, description="Assigned lead officer")


class CaseUpdate(BaseModel):
    """Payload for updating Case details."""
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=20)
    priority: Optional[CasePriority] = None
    crime_type: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    police_station: Optional[str] = None
    area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    resolution_status: Optional[str] = None
    case_outcome: Optional[str] = None


class CaseAssignRequest(BaseModel):
    """Payload for assigning or reassigning a lead investigator."""
    lead_investigator_id: uuid.UUID


class CaseStatusUpdateRequest(BaseModel):
    """Payload for updating Case status through the investigative lifecycle."""
    status: CaseStatus
    note: Optional[str] = Field(None, description="Reason or investigative note accompanying status transition")


class CaseNoteCreate(BaseModel):
    """Payload for adding an investigative case note."""
    note: str = Field(..., min_length=5, description="Investigative note content")


class CaseNoteResponse(BaseModel):
    """Response representation of an investigation note."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    author_id: uuid.UUID
    note: str
    created_at: datetime


class CaseResponse(BaseModel):
    """Summary response representation of a Case."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_number: str
    title: str
    description: Optional[str] = None
    crime_category: str
    crime_type: Optional[str] = None
    status: CaseStatus
    priority: CasePriority
    fir_id: Optional[uuid.UUID] = None
    lead_investigator_id: Optional[uuid.UUID] = None
    created_by_id: Optional[uuid.UUID] = None
    incident_date: Optional[date] = None
    incident_time: Optional[time] = None
    city: Optional[str] = None
    region: Optional[str] = None
    police_station: Optional[str] = None
    area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = None
    is_synthetic: bool = False
    data_source: str = "KRITAGAS_LIVE"
    resolution_status: Optional[str] = None
    case_outcome: Optional[str] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    created_at: datetime


class CaseDetailResponse(BaseModel):
    """Comprehensive detail representation of a Case."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_number: str
    title: str
    description: str
    crime_category: str
    crime_type: Optional[str] = None
    status: CaseStatus
    priority: CasePriority
    fir_id: Optional[uuid.UUID] = None
    lead_investigator_id: Optional[uuid.UUID] = None
    created_by_id: Optional[uuid.UUID] = None
    incident_date: Optional[date] = None
    incident_time: Optional[time] = None
    city: Optional[str] = None
    region: Optional[str] = None
    police_station: Optional[str] = None
    area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = None
    is_synthetic: bool = False
    data_source: str = "KRITAGAS_LIVE"
    resolution_status: Optional[str] = None
    case_outcome: Optional[str] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    notes: List[CaseNoteResponse] = []
    evidence_count: int = 0


class CaseTimelineEventResponse(BaseModel):
    """Standardized representation of a chronological timeline event."""
    id: str
    timestamp: datetime
    event_type: str
    title: str
    description: str
    user_id: Optional[uuid.UUID] = None
