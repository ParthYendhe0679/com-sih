"""Core module initialization for KRITAGAS backend."""

from app.core.config import settings
from app.core.constants import (
    AuditAction,
    CasePriority,
    CaseStatus,
    CrimeCategory,
    DocumentProcessingStatus,
    EvidenceStatus,
    EvidenceType,
    FIRPriority,
    FIRStatus,
    NotificationType,
    UserRole,
)
from app.core.exceptions import (
    AuthenticationException,
    ConflictException,
    InvalidStateTransitionException,
    PermissionDeniedException,
    ResourceNotFoundException,
    ValidationException,
)
from app.core.logging import get_logger

__all__ = [
    "settings",
    "UserRole",
    "FIRStatus",
    "FIRPriority",
    "CaseStatus",
    "CasePriority",
    "EvidenceType",
    "EvidenceStatus",
    "DocumentProcessingStatus",
    "NotificationType",
    "AuditAction",
    "CrimeCategory",
    "ResourceNotFoundException",
    "PermissionDeniedException",
    "InvalidStateTransitionException",
    "ConflictException",
    "AuthenticationException",
    "ValidationException",
    "get_logger",
]
