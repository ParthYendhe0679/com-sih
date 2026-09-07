"""Blockchain evidence integrity database models.

Extends the existing SQLAlchemy schema with four tables for immutable integrity
tracking, chain of custody, and investigation audit trails.
"""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.blockchain.constants import (
    BlockchainRecordStatus,
    CustodyEventType,
    EntityType,
    IntegrityStatus,
    InvestigationAuditAction,
    RecordType,
)
from app.models.base import Base, GUID, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.case import Case
    from app.models.evidence import Evidence
    from app.models.user import User


class BlockchainRecord(Base, UUIDMixin, TimestampMixin):
    """Immutable blockchain transaction record storing cryptographic hashes and metadata.

    This table acts as the mock blockchain ledger in development mode — each row
    represents a 'block' with a reference to the previous block's hash, creating
    an auditable, tamper-evident chain.
    """

    __tablename__ = "blockchain_records"

    record_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
    )
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
    )
    entity_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
    )
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    data_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    previous_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    block_number: Mapped[int] = mapped_column(
        BigInteger, nullable=False, index=True,
    )
    transaction_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True,
    )

    provider: Mapped[str] = mapped_column(String(30), nullable=False, default="mock")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=BlockchainRecordStatus.REGISTERED.value,
        index=True,
    )

    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    case: Mapped[Optional["Case"]] = relationship("Case", lazy="selectin")


class EvidenceIntegrityRecord(Base, UUIDMixin, TimestampMixin):
    """Links an evidence item to its blockchain-registered cryptographic hash,
    enabling tamper detection by comparing current vs original hashes.
    """

    __tablename__ = "evidence_integrity_records"

    evidence_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("evidence.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, default=EntityType.EVIDENCE.value)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    original_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    verification_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=IntegrityStatus.REGISTERED.value, index=True,
    )

    blockchain_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("blockchain_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    evidence: Mapped[Optional["Evidence"]] = relationship("Evidence", lazy="selectin")
    case: Mapped[Optional["Case"]] = relationship("Case", lazy="selectin")
    blockchain_record: Mapped[Optional["BlockchainRecord"]] = relationship(
        "BlockchainRecord", lazy="selectin",
    )
    verified_by: Mapped[Optional["User"]] = relationship("User", lazy="selectin")


class ChainOfCustodyEvent(Base, UUIDMixin):
    """Records every significant movement or processing event for a piece of evidence,
    forming a cryptographically linked chain for tamper-evident custody tracking.
    """

    __tablename__ = "chain_of_custody_events"

    evidence_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("evidence.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    performed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    previous_custodian_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), nullable=True,
    )
    new_custodian_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), nullable=True,
    )

    event_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    previous_event_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    blockchain_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("blockchain_records.id", ondelete="SET NULL"),
        nullable=True,
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    evidence: Mapped[Optional["Evidence"]] = relationship("Evidence", lazy="selectin")
    case: Mapped[Optional["Case"]] = relationship("Case", lazy="selectin")
    performed_by: Mapped[Optional["User"]] = relationship("User", lazy="selectin")
    blockchain_record: Mapped[Optional["BlockchainRecord"]] = relationship(
        "BlockchainRecord", lazy="selectin",
    )


class InvestigationAuditRecord(Base, UUIDMixin):
    """Blockchain-backed investigation audit trail recording every significant
    action taken during the lifecycle of a case investigation.
    """

    __tablename__ = "investigation_audit_records"

    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    action: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_role: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    data_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    previous_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    blockchain_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("blockchain_records.id", ondelete="SET NULL"),
        nullable=True,
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    case: Mapped[Optional["Case"]] = relationship("Case", lazy="selectin")
    actor: Mapped[Optional["User"]] = relationship("User", lazy="selectin")
    blockchain_record: Mapped[Optional["BlockchainRecord"]] = relationship(
        "BlockchainRecord", lazy="selectin",
    )
