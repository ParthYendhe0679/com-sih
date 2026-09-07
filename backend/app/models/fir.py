"""First Information Report (FIR) database model."""

import uuid
from datetime import date, datetime, time
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, JSON, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DocumentProcessingStatus, FIRPriority, FIRStatus
from app.models.base import Base, GUID, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.case import Case
    from app.models.evidence import Evidence
    from app.models.user import User


class FIR(Base, UUIDMixin, TimestampMixin):
    """First Information Report entity representing an official complaint."""

    __tablename__ = "firs"

    fir_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    crime_category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)

    incident_date: Mapped[date] = mapped_column(Date, nullable=False)
    incident_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    incident_location: Mapped[str] = mapped_column(String(255), nullable=False)

    status: Mapped[FIRStatus] = mapped_column(
        Enum(FIRStatus, name="fir_status_enum"),
        default=FIRStatus.DRAFT,
        nullable=False,
        index=True,
    )
    priority: Mapped[FIRPriority] = mapped_column(
        Enum(FIRPriority, name="fir_priority_enum"),
        default=FIRPriority.MEDIUM,
        nullable=False,
        index=True,
    )

    submitted_by_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    additional_information: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)

    # Offline FIR intake & document metadata
    is_offline: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    document_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    document_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    document_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    processing_status: Mapped[DocumentProcessingStatus] = mapped_column(
        Enum(DocumentProcessingStatus, name="doc_processing_status_enum"),
        default=DocumentProcessingStatus.NOT_PROCESSED,
        nullable=False,
        index=True,
    )

    # Relationships
    submitted_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[submitted_by_id],
        back_populates="submitted_firs",
        lazy="selectin",
    )
    reviewed_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[reviewed_by_id],
        back_populates="reviewed_firs",
        lazy="selectin",
    )
    case: Mapped[Optional["Case"]] = relationship(
        "Case",
        back_populates="fir",
        uselist=False,
        lazy="selectin",
    )
    evidence: Mapped[List["Evidence"]] = relationship(
        "Evidence",
        back_populates="fir",
        lazy="selectin",
    )
