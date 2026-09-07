"""Database models export for KRITAGAS backend."""

from app.models.audit_log import AuditLog
from app.models.base import Base, GUID, TimestampMixin, UUIDMixin
from app.models.case import Case
from app.models.case_note import CaseNote
from app.models.data_architecture import (
    CaseEntityContext,
    CaseMember,
    DataSource,
    EntityRelationship,
    InvestigationReport,
)
from app.models.evidence import Evidence
from app.models.fir import FIR
from app.models.notification import Notification
from app.models.user import User

_AI_MODEL_NAMES = {
    "AnalysisJob",
    "Anomaly",
    "CaseSimilarity",
    "Correlation",
    "Entity",
    "EntityMatch",
    "IntelligenceInsight",
}

_BLOCKCHAIN_MODEL_NAMES = {
    "BlockchainRecord",
    "EvidenceIntegrityRecord",
    "ChainOfCustodyEvent",
    "InvestigationAuditRecord",
}


def __getattr__(name: str):
    """Lazily load AI/ML and Blockchain models to eliminate circular import loops."""
    if name in _AI_MODEL_NAMES:
        import app.ai_ml.models.ai_models as aimodels
        val = getattr(aimodels, name)
        globals()[name] = val
        return val
    if name in _BLOCKCHAIN_MODEL_NAMES:
        import app.blockchain.models as bcmodels
        val = getattr(bcmodels, name)
        globals()[name] = val
        return val
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


__all__ = [
    "Base",
    "GUID",
    "UUIDMixin",
    "TimestampMixin",
    "User",
    "FIR",
    "Case",
    "CaseNote",
    "CaseMember",
    "DataSource",
    "CaseEntityContext",
    "EntityRelationship",
    "InvestigationReport",
    "Evidence",
    "Notification",
    "AuditLog",
    "Entity",
    "EntityMatch",
    "CaseSimilarity",
    "Correlation",
    "IntelligenceInsight",
    "Anomaly",
    "AnalysisJob",
    "BlockchainRecord",
    "EvidenceIntegrityRecord",
    "ChainOfCustodyEvent",
    "InvestigationAuditRecord",
]

