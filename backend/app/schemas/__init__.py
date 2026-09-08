"""Schemas module initialization."""

from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.case import (
    CaseAssignRequest,
    CaseCreate,
    CaseDetailResponse,
    CaseNoteCreate,
    CaseNoteResponse,
    CaseResponse,
    CaseStatusUpdateRequest,
    CaseTimelineEventResponse,
    CaseUpdate,
)
from app.schemas.common import (
    APIResponse,
    ErrorDetail,
    PaginatedResponse,
    PaginationParams,
)
from app.schemas.dashboard import (
    AdminDashboardResponse,
    CitizenDashboardResponse,
    PoliceDashboardResponse,
)
from app.schemas.evidence import EvidenceCreate, EvidenceResponse
from app.schemas.fir import (
    FIRCreate,
    FIRDetailResponse,
    FIRInfoRequest,
    FIRPriority,
    FIRProvideInfoRequest,
    FIRResponse,
    FIRReviewRequest,
    FIRStatus,
    FIRUpdate,
    OfflineFIRCreate,
)
from app.schemas.notification import NotificationResponse
from app.schemas.search import SearchResultsResponse
from app.schemas.user import (
    PoliceAccountCreate,
    UserResponse,
    UserStatusUpdate,
    UserUpdate,
)
from app.schemas.graph import (
    CaseGraphResponse,
    CaseNetworkResponse,
    CrossCaseEntityItem,
    GraphAnalyticsResponse,
    GraphEdge,
    GraphNode,
    GraphStatistics,
    GraphSyncRequest,
    GraphSyncResponse,
    HiddenConnectionItem,
    SharedResourceItem,
    ShortestPathResponse,
)

__all__ = [
    "APIResponse",
    "ErrorDetail",
    "PaginationParams",
    "PaginatedResponse",
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "RefreshTokenRequest",
    "UserResponse",
    "UserUpdate",
    "UserStatusUpdate",
    "PoliceAccountCreate",
    "FIRCreate",
    "FIRUpdate",
    "FIRReviewRequest",
    "FIRInfoRequest",
    "FIRProvideInfoRequest",
    "OfflineFIRCreate",
    "FIRResponse",
    "FIRDetailResponse",
    "CaseCreate",
    "CaseUpdate",
    "CaseAssignRequest",
    "CaseStatusUpdateRequest",
    "CaseNoteCreate",
    "CaseNoteResponse",
    "CaseResponse",
    "CaseDetailResponse",
    "CaseTimelineEventResponse",
    "EvidenceCreate",
    "EvidenceResponse",
    "NotificationResponse",
    "CitizenDashboardResponse",
    "PoliceDashboardResponse",
    "AdminDashboardResponse",
    "SearchResultsResponse",
]
