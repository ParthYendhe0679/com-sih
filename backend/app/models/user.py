"""User database model."""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import UserRole
from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.case import Case
    from app.models.evidence import Evidence
    from app.models.fir import FIR
    from app.models.notification import Notification


class User(Base, UUIDMixin, TimestampMixin):
    """User account entity representing Citizens, Police Officers, and Administrators."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum"),
        default=UserRole.CITIZEN,
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Police-specific profile fields
    badge_number: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rank: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    submitted_firs: Mapped[List["FIR"]] = relationship(
        "FIR",
        foreign_keys="FIR.submitted_by_id",
        back_populates="submitted_by",
        lazy="selectin",
    )
    reviewed_firs: Mapped[List["FIR"]] = relationship(
        "FIR",
        foreign_keys="FIR.reviewed_by_id",
        back_populates="reviewed_by",
        lazy="selectin",
    )
    investigated_cases: Mapped[List["Case"]] = relationship(
        "Case",
        foreign_keys="Case.lead_investigator_id",
        back_populates="lead_investigator",
        lazy="selectin",
    )
    created_cases: Mapped[List["Case"]] = relationship(
        "Case",
        foreign_keys="Case.created_by_id",
        back_populates="created_by",
        lazy="selectin",
    )
    uploaded_evidence: Mapped[List["Evidence"]] = relationship(
        "Evidence",
        back_populates="uploaded_by",
        lazy="selectin",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
        lazy="selectin",
    )
