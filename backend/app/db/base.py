"""Import all models for Alembic autogeneration and metadata discovery."""

from app.models.audit_log import AuditLog  # noqa: F401
from app.models.base import Base  # noqa: F401
from app.models.case import Case  # noqa: F401
from app.models.case_note import CaseNote  # noqa: F401
from app.models.data_architecture import (  # noqa: F401
    CaseEntityContext,
    CaseMember,
    DataSource,
    EntityRelationship,
    InvestigationReport,
)
from app.models.evidence import Evidence  # noqa: F401
from app.models.fir import FIR  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.user import User  # noqa: F401

# AI / ML Intelligence Models
from app.ai_ml.models.ai_models import (  # noqa: F401
    AnalysisJob,
    Anomaly,
    CaseSimilarity,
    Correlation,
    Entity,
    EntityMatch,
    IntelligenceInsight,
)

# Blockchain Integrity & Custody Models
from app.blockchain.models import (  # noqa: F401
    BlockchainRecord,
    ChainOfCustodyEvent,
    EvidenceIntegrityRecord,
    InvestigationAuditRecord,
)

