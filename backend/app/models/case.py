"""Case database model."""

import uuid
from datetime import date, datetime, time, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import CasePriority, CaseStatus
from app.models.base import Base, GUID, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.case_note import CaseNote
    from app.models.evidence import Evidence
    from app.models.fir import FIR
    from app.models.user import User


class Case(Base, UUIDMixin, TimestampMixin):
    """Official criminal investigation Case entity."""

    __tablename__ = "cases"

    case_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    crime_category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    crime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    incident_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    incident_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)

    # Geographic Demarcation (Mumbai, Thane, Navi Mumbai)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    region: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    police_station: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    area: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Provenance & Case Resolution Lifecycle
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    data_source: Mapped[str] = mapped_column(String(50), default="KRITAGAS_LIVE", nullable=False)
    resolution_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    case_outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[CaseStatus] = mapped_column(
        Enum(CaseStatus, name="case_status_enum"),
        default=CaseStatus.OPEN,
        nullable=False,
        index=True,
    )
    priority: Mapped[CasePriority] = mapped_column(
        Enum(CasePriority, name="case_priority_enum"),
        default=CasePriority.MEDIUM,
        nullable=False,
        index=True,
    )

    # Originating FIR (nullable in case of direct offline entry or spontaneous investigation)
    fir_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("firs.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
        index=True,
    )

    lead_investigator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    fir: Mapped[Optional["FIR"]] = relationship(
        "FIR",
        back_populates="case",
        lazy="select",
    )
    lead_investigator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[lead_investigator_id],
        back_populates="investigated_cases",
        lazy="select",
    )
    created_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="created_cases",
        lazy="select",
    )
    evidence: Mapped[List["Evidence"]] = relationship(
        "Evidence",
        back_populates="case",
        cascade="all, delete-orphan",
        lazy="select",
    )
    notes: Mapped[List["CaseNote"]] = relationship(
        "CaseNote",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="CaseNote.created_at.desc()",
        lazy="select",
    )
