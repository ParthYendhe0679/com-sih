"""Dashboard metrics and analytical response schemas."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from app.schemas.case import CaseResponse
from app.schemas.fir import FIRResponse


class CitizenDashboardResponse(BaseModel):
    """Aggregated dashboard statistics for Citizen users."""
    total_firs: int
    pending_firs: int
    accepted_firs: int
    rejected_firs: int
    recent_firs: List[FIRResponse]
    unread_notifications_count: int


class PoliceDashboardResponse(BaseModel):
    """Operational dashboard metrics for Law Enforcement Officers."""
    assigned_cases: int
    open_cases: int
    pending_fir_reviews: int
    high_priority_cases: int
    recent_cases: List[CaseResponse]
    recent_firs_to_review: List[FIRResponse]


class AuditLogSummary(BaseModel):
    """Compact audit entry for administrative oversight."""
    id: uuid.UUID
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    description: str
    user_id: Optional[uuid.UUID] = None
    created_at: datetime


class AdminDashboardResponse(BaseModel):
    """System-wide management statistics for Administrators."""
    total_users: int
    total_police_officers: int
    total_citizens: int
    total_firs: int
    total_cases: int
    fir_status_distribution: Dict[str, int]
    case_status_distribution: Dict[str, int]
    recent_audit_logs: List[AuditLogSummary]
