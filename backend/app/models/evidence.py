"""Evidence metadata database model."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, Optional
from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import EvidenceStatus, EvidenceType
from app.models.base import Base, GUID, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.case import Case
    from app.models.fir import FIR
    from app.models.user import User


class Evidence(Base, UUIDMixin, TimestampMixin):
    """Investigative evidence metadata entity linked to a FIR, Case, or both."""

    __tablename__ = "evidence"
    __table_args__ = (
        CheckConstraint("case_id IS NOT NULL OR fir_id IS NOT NULL", name="ck_evidence_has_parent"),
    )


    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    fir_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("firs.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    evidence_type: Mapped[EvidenceType] = mapped_column(
        Enum(EvidenceType, name="evidence_type_enum"),
        default=EvidenceType.DOCUMENT,
        nullable=False,
        index=True,
    )

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    status: Mapped[EvidenceStatus] = mapped_column(
        Enum(EvidenceStatus, name="evidence_status_enum"),
        default=EvidenceStatus.COLLECTED,
        nullable=False,
        index=True,
    )

    # Relationships
    case: Mapped[Optional["Case"]] = relationship("Case", back_populates="evidence")
    fir: Mapped[Optional["FIR"]] = relationship("FIR", back_populates="evidence")
    uploaded_by: Mapped["User"] = relationship("User", back_populates="uploaded_evidence", lazy="selectin")
