"""Pydantic schemas for statistical and behavioral anomaly detection."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AnomalyItem(BaseModel):
    """Detected anomaly requiring investigator verification."""
    id: uuid.UUID
    case_id: uuid.UUID
    entity_id: Optional[uuid.UUID] = None
    entity_name: Optional[str] = None
    anomaly_type: str
    score: float = Field(ge=0.0, le=1.0)
    baseline_value: Optional[float] = None
    observed_value: Optional[float] = None
    deviation_metric: Optional[str] = None
    description: str
    status: str = "REQUIRES_INVESTIGATION"
    evidence: List[str] = Field(default_factory=list)
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyListResponse(BaseModel):
    """Collection of flagged anomalies for a case."""
    case_id: uuid.UUID
    total_anomalies: int
    items: List[AnomalyItem]
