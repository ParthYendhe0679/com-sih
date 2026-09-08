"""KRITAGAS Part 5 Centralized Data Architecture database models.

Provides standardized PostgreSQL models connecting Cases, FIRs, Evidence,
Entities, Entity Contexts, Relationships, Data Sources, Investigation Reports,
and Blockchain records into a unified, synchronized schema.
"""

import uuid
from datetime import date, datetime, time, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    JSON,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, GUID, TimestampMixin, UUIDMixin


class CaseMember(Base, UUIDMixin, TimestampMixin):
    """Investigation team member assignment linking an investigator/analyst to a Case."""

    __tablename__ = "case_members"
    __table_args__ = (
        UniqueConstraint("case_id", "user_id", name="uq_case_member"),
    )

    case_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        default="INVESTIGATOR",
        nullable=False,
        index=True,
    )  # LEAD_INVESTIGATOR, INVESTIGATOR, ANALYST, FORENSIC_EXPERT, SUPERVISOR
    assigned_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    permissions_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    case = relationship("Case", backref="team_members", lazy="selectin")
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id], lazy="selectin")


class DataSource(Base, UUIDMixin, TimestampMixin):
    """Generic intelligence data source tracker for FIRs, CDR, banking, CCTV, and external feeds."""

    __tablename__ = "data_sources"

    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # FIR, CALL_RECORD, FINANCIAL_RECORD, CCTV, SOCIAL_MEDIA, CRIMINAL_HISTORY, VEHICLE_RECORD, BANK_RECORD, MANUAL_INPUT, OTHER
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    fir_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("firs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    evidence_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("evidence.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_reference: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_system: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    processing_status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False,
        index=True,
    )  # PENDING, QUEUED, PROCESSING, COMPLETED, FAILED
    raw_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    case = relationship("Case", backref="data_sources", lazy="selectin")
    fir = relationship("FIR", backref="data_sources", lazy="selectin")
    evidence = relationship("Evidence", backref="data_sources", lazy="selectin")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id], lazy="selectin")


class CaseEntityContext(Base, UUIDMixin, TimestampMixin):
    """Contextual binding connecting a global canonical Entity to an investigation Case.
    Allows real-world entities (e.g., Person: Rahul Sharma) to participate in multiple
    cases with differing roles (Suspect in Case A, Witness in Case B) without data duplication.
    """

    __tablename__ = "case_entity_contexts"
    __table_args__ = (
        UniqueConstraint("case_id", "entity_id", "role", name="uq_case_entity_role"),
    )

    case_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        default="PERSON_OF_INTEREST",
        nullable=False,
        index=True,
    )  # SUSPECT, ACCUSED, WITNESS, VICTIM, COMPLAINANT, ASSOCIATE, PERSON_OF_INTEREST, MENTIONED
    fir_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("firs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_evidence_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("evidence.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    extraction_method: Mapped[str] = mapped_column(
        String(50),
        default="MANUAL_ENTRY",
        nullable=False,
    )  # OCR_NER, NLP_EXTRACTOR, AI_AGENT, MANUAL_ENTRY
    original_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50),
        default="EXTRACTED",
        nullable=False,
        index=True,
    )  # EXTRACTED, NORMALIZED, RESOLVED, POSSIBLE_MATCH, CONFIRMED, REJECTED
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    case = relationship("Case", backref="entity_contexts", lazy="selectin")
    entity = relationship("Entity", backref="case_contexts", lazy="selectin")
    fir = relationship("FIR", lazy="selectin")
    source_evidence = relationship("Evidence", lazy="selectin")


class EntityRelationship(Base, UUIDMixin, TimestampMixin):
    """Directed, evidence-backed relationship edge connecting two entities within a Case."""

    __tablename__ = "entity_relationships"

    source_entity_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_entity_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relationship_type: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        index=True,
    )  # CALLED, OWNS, TRANSFERRED_MONEY_TO, ASSOCIATED_WITH, LOCATED_AT, COMMUNICATED_WITH, EMPLOYED_BY, FAMILY_OF
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    source_evidence_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("evidence.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    extraction_method: Mapped[str] = mapped_column(
        String(60),
        default="NLP_DEPENDENCY_PARSE",
        nullable=False,
    )  # NLP_DEPENDENCY_PARSE, AI_RELATION_EXTRACTOR, TELECOM_CDR, FINANCIAL_LEDGER, MANUAL_ENTRY
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="DETECTED",
        nullable=False,
        index=True,
    )  # DETECTED, CONFIRMED, DISPUTED, DISPROVED
    evidence_chain: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)

    # Relationships
    source_entity = relationship("Entity", foreign_keys=[source_entity_id], lazy="selectin")
    target_entity = relationship("Entity", foreign_keys=[target_entity_id], lazy="selectin")
    case = relationship("Case", backref="relationships", lazy="selectin")
    source_evidence = relationship("Evidence", lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")


class InvestigationReport(Base, UUIDMixin, TimestampMixin):
    """Official investigation reports, AI dossiers, and SAMANVAYA multi-agent synthesis reports."""

    __tablename__ = "investigation_reports"

    case_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_type: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        index=True,
    )  # AI_DOSSIER, SAMANVAYA_SYNTHESIS, FORENSIC_SUMMARY, INVESTIGATION_SUMMARY, CHARGE_SHEET_DRAFT
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    content_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    generated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    agent_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )  # SAMANVAYA_MASTER, CDR_AGENT, FINANCIAL_AGENT, CCTV_AGENT, HEURISTIC_ENGINE
    status: Mapped[str] = mapped_column(
        String(30),
        default="FINAL",
        nullable=False,
        index=True,
    )  # DRAFT, FINAL, APPROVED, ARCHIVED
    blockchain_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("blockchain_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)

    # Relationships
    case = relationship("Case", backref="reports", lazy="selectin")
    generated_by = relationship("User", foreign_keys=[generated_by_id], lazy="selectin")
    blockchain_record = relationship("BlockchainRecord", lazy="selectin")


class GeoTemporalEvent(Base, UUIDMixin, TimestampMixin):
    """Geo-temporal intelligence event for crime hotspotting, pattern mining, and predictive spatial analysis."""

    __tablename__ = "geo_temporal_events"

    event_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    area: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=False, index=True)

    incident_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    incident_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    crime_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    time_bucket: Mapped[str] = mapped_column(String(50), default="NIGHT", nullable=False)  # MORNING, AFTERNOON, EVENING, NIGHT, LATE_NIGHT
    location_cluster: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    risk_level: Mapped[str] = mapped_column(String(50), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL

    related_case_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    pattern_identifier: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    data_source: Mapped[str] = mapped_column(String(50), default="KRITAGAS_DEMO", nullable=False)

    # Relationship
    case = relationship("Case", backref="geo_events", lazy="selectin")

