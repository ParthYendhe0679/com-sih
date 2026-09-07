"""SQLAlchemy database models for KRITAGAS AI/ML Intelligence Engine."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, GUID, TimestampMixin, UUIDMixin


class Entity(Base, UUIDMixin, TimestampMixin):
    """Canonical or observed investigation entity (Person, Phone, Vehicle, etc.)."""

    __tablename__ = "entities"

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
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    normalized_value: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    source_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attributes_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    is_canonical: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    canonical_entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("entities.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    case = relationship("Case", backref="entities", lazy="selectin")
    fir = relationship("FIR", backref="entities", lazy="selectin")


class EntityMatch(Base, UUIDMixin, TimestampMixin):
    """Candidate or confirmed match between two entities during resolution."""

    __tablename__ = "entity_matches"

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
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING_REVIEW",
        nullable=False,
        index=True,
    )  # PENDING_REVIEW, CONFIRMED_SAME, REJECTED, FLAGGED
    similarity_breakdown: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    supporting_evidence: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    conflicting_evidence: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    source_entity = relationship("Entity", foreign_keys=[source_entity_id], lazy="selectin")
    target_entity = relationship("Entity", foreign_keys=[target_entity_id], lazy="selectin")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id], lazy="selectin")


class CaseSimilarity(Base, UUIDMixin, TimestampMixin):
    """Pairwise historical or cross-case similarity record with explainable features."""

    __tablename__ = "case_similarities"

    source_case_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_case_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    semantic_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    modus_operandi_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    entity_overlap_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    location_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    temporal_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    common_features: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    explanation_summary: Mapped[str] = mapped_column(Text, nullable=False)
    supporting_records: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)

    # Relationships
    source_case = relationship("Case", foreign_keys=[source_case_id], lazy="selectin")
    target_case = relationship("Case", foreign_keys=[target_case_id], lazy="selectin")


class Correlation(Base, UUIDMixin, TimestampMixin):
    """Discovered multi-hop intelligence correlation across diverse data sources."""

    __tablename__ = "correlations"

    case_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    target_entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    correlation_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_chain: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    source_records: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)

    # Relationships
    case = relationship("Case", backref="correlations", lazy="selectin")
    source_entity = relationship("Entity", foreign_keys=[source_entity_id], lazy="selectin")
    target_entity = relationship("Entity", foreign_keys=[target_entity_id], lazy="selectin")


class IntelligenceInsight(Base, UUIDMixin, TimestampMixin):
    """Explainable investigation lead, pattern, or anomaly insight."""

    __tablename__ = "intelligence_insights"

    case_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    insight_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    facts: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    inferences: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    supporting_records: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    limitations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(50), default="MEDIUM", nullable=False)

    # Relationships
    case = relationship("Case", backref="insights", lazy="selectin")


class Anomaly(Base, UUIDMixin, TimestampMixin):
    """Flagged behavioral, financial, or temporal anomaly requiring investigator inquiry."""

    __tablename__ = "anomalies"

    case_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("entities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    anomaly_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    baseline_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    observed_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    deviation_metric: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="REQUIRES_INVESTIGATION",
        nullable=False,
    )
    evidence: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)

    # Relationships
    case = relationship("Case", backref="anomalies", lazy="selectin")
    entity = relationship("Entity", lazy="selectin")


class AnalysisJob(Base, UUIDMixin, TimestampMixin):
    """Asynchronous background investigation analysis job tracking."""

    __tablename__ = "analysis_jobs"

    case_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="QUEUED",
        nullable=False,
        index=True,
    )  # QUEUED, PROCESSING, COMPLETED, FAILED
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_stage: Mapped[str] = mapped_column(
        String(100),
        default="QUEUED",
        nullable=False,
    )
    triggered_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    result_summary: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    case = relationship("Case", backref="analysis_jobs", lazy="selectin")
    triggered_by = relationship("User", lazy="selectin")
