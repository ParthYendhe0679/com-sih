"""Constants and Enums for the KRITAGAS platform."""

from enum import Enum


class StrEnum(str, Enum):
    """String Enum base class that serializes directly to string."""

    def __str__(self) -> str:
        return str(self.value)


class UserRole(StrEnum):
    """User access roles within KRITAGAS."""
    CITIZEN = "CITIZEN"
    POLICE = "POLICE"
    ADMIN = "ADMIN"


class FIRStatus(StrEnum):
    """Lifecycle statuses for First Information Reports."""
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    MORE_INFORMATION_REQUIRED = "MORE_INFORMATION_REQUIRED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CONVERTED_TO_CASE = "CONVERTED_TO_CASE"


class FIRPriority(StrEnum):
    """Priority levels for FIR processing."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CaseStatus(StrEnum):
    """Lifecycle statuses for official criminal investigation Cases."""
    OPEN = "OPEN"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"
    ACTIVE = "ACTIVE"
    ON_HOLD = "ON_HOLD"
    CLOSED = "CLOSED"


class CasePriority(StrEnum):
    """Priority levels for criminal Cases."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class EvidenceType(StrEnum):
    """Supported categories of investigative evidence."""
    DOCUMENT = "DOCUMENT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    OTHER = "OTHER"


class EvidenceStatus(StrEnum):
    """Processing and validation statuses for evidence items."""
    COLLECTED = "COLLECTED"
    UNDER_ANALYSIS = "UNDER_ANALYSIS"
    VERIFIED = "VERIFIED"
    FLAGGED = "FLAGGED"
    ARCHIVED = "ARCHIVED"


class DocumentProcessingStatus(StrEnum):
    """Processing status for offline scanned documents (OCR/NLP pipeline readiness)."""
    NOT_PROCESSED = "NOT_PROCESSED"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class NotificationType(StrEnum):
    """Types of system notifications sent to users."""
    INFO = "INFO"
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    ACTION_REQUIRED = "ACTION_REQUIRED"


class AuditAction(StrEnum):
    """Actions recorded in immutable audit logs."""
    USER_REGISTER = "USER_REGISTER"
    USER_LOGIN = "USER_LOGIN"
    USER_LOGOUT = "USER_LOGOUT"
    USER_STATUS_UPDATED = "USER_STATUS_UPDATED"
    POLICE_ACCOUNT_CREATED = "POLICE_ACCOUNT_CREATED"

    FIR_CREATED = "FIR_CREATED"
    FIR_UPDATED = "FIR_UPDATED"
    FIR_SUBMITTED = "FIR_SUBMITTED"
    FIR_REVIEWED = "FIR_REVIEWED"
    FIR_ACCEPTED = "FIR_ACCEPTED"
    FIR_REJECTED = "FIR_REJECTED"
    FIR_MORE_INFO_REQUESTED = "FIR_MORE_INFO_REQUESTED"
    FIR_INFO_PROVIDED = "FIR_INFO_PROVIDED"
    OFFLINE_FIR_REGISTERED = "OFFLINE_FIR_REGISTERED"

    CASE_CREATED = "CASE_CREATED"
    CASE_UPDATED = "CASE_UPDATED"
    CASE_ASSIGNED = "CASE_ASSIGNED"
    CASE_STATUS_CHANGED = "CASE_STATUS_CHANGED"
    CASE_NOTE_ADDED = "CASE_NOTE_ADDED"

    EVIDENCE_ADDED = "EVIDENCE_ADDED"
    EVIDENCE_UPDATED = "EVIDENCE_UPDATED"
    EVIDENCE_STATUS_CHANGED = "EVIDENCE_STATUS_CHANGED"
    EVIDENCE_INTEGRITY_REGISTERED = "EVIDENCE_INTEGRITY_REGISTERED"
    EVIDENCE_VERIFIED = "EVIDENCE_VERIFIED"
    EVIDENCE_TAMPER_DETECTED = "EVIDENCE_TAMPER_DETECTED"
    AI_REPORT_INTEGRITY_REGISTERED = "AI_REPORT_INTEGRITY_REGISTERED"
    CUSTODY_EVENT_CREATED = "CUSTODY_EVENT_CREATED"

    SYSTEM_CONFIG_CHANGED = "SYSTEM_CONFIG_CHANGED"


class CrimeCategory(StrEnum):
    """Standard crime classification categories."""
    ROBBERY = "Robbery"
    FRAUD = "Fraud"
    KIDNAPPING = "Kidnapping"
    MURDER = "Murder"
    EXTORTION = "Extortion"
    DRUG_TRAFFICKING = "Drug Trafficking"
    VEHICLE_THEFT = "Vehicle Theft"
    CYBERCRIME = "Cybercrime"
    ASSAULT = "Assault"
    ARMS_TRAFFICKING = "Arms Trafficking"
    MONEY_LAUNDERING = "Money Laundering"
    HUMAN_TRAFFICKING = "Human Trafficking"
    OTHER = "Other"
