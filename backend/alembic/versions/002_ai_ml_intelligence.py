"""AI/ML Intelligence Engine schema for entities, matches, similarities, correlations, insights, anomalies, and jobs.

Revision ID: 002_ai_ml_intelligence
Revises: 001_initial_schema
Create Date: 2026-09-07 22:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002_ai_ml_intelligence"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Entities table
    op.create_table(
        "entities",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=True),
        sa.Column("fir_id", sa.CHAR(36), sa.ForeignKey("firs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("normalized_value", sa.String(255), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, default=1.0),
        sa.Column("source_text", sa.Text(), nullable=True),
        sa.Column("attributes_json", sa.JSON(), nullable=True),
        sa.Column("is_canonical", sa.Boolean(), nullable=False, default=True),
        sa.Column("canonical_entity_id", sa.CHAR(36), sa.ForeignKey("entities.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_entities_id", "entities", ["id"])
    op.create_index("ix_entities_case_id", "entities", ["case_id"])
    op.create_index("ix_entities_fir_id", "entities", ["fir_id"])
    op.create_index("ix_entities_entity_type", "entities", ["entity_type"])
    op.create_index("ix_entities_name", "entities", ["name"])
    op.create_index("ix_entities_normalized_value", "entities", ["normalized_value"])

    # 2. Entity Matches table
    op.create_table(
        "entity_matches",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("source_entity_id", sa.CHAR(36), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_entity_id", sa.CHAR(36), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, default="PENDING_REVIEW"),
        sa.Column("similarity_breakdown", sa.JSON(), nullable=True),
        sa.Column("supporting_evidence", sa.JSON(), nullable=True),
        sa.Column("conflicting_evidence", sa.JSON(), nullable=True),
        sa.Column("reviewed_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_entity_matches_id", "entity_matches", ["id"])
    op.create_index("ix_entity_matches_source_entity_id", "entity_matches", ["source_entity_id"])
    op.create_index("ix_entity_matches_target_entity_id", "entity_matches", ["target_entity_id"])
    op.create_index("ix_entity_matches_status", "entity_matches", ["status"])

    # 3. Case Similarities table
    op.create_table(
        "case_similarities",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("source_case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("similarity_score", sa.Float(), nullable=False),
        sa.Column("semantic_score", sa.Float(), nullable=False, default=0.0),
        sa.Column("modus_operandi_score", sa.Float(), nullable=False, default=0.0),
        sa.Column("entity_overlap_score", sa.Float(), nullable=False, default=0.0),
        sa.Column("location_score", sa.Float(), nullable=False, default=0.0),
        sa.Column("temporal_score", sa.Float(), nullable=False, default=0.0),
        sa.Column("common_features", sa.JSON(), nullable=True),
        sa.Column("explanation_summary", sa.Text(), nullable=False),
        sa.Column("supporting_records", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_case_similarities_id", "case_similarities", ["id"])
    op.create_index("ix_case_similarities_source_case_id", "case_similarities", ["source_case_id"])
    op.create_index("ix_case_similarities_target_case_id", "case_similarities", ["target_case_id"])
    op.create_index("ix_case_similarities_similarity_score", "case_similarities", ["similarity_score"])

    # 4. Correlations table
    op.create_table(
        "correlations",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_entity_id", sa.CHAR(36), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=True),
        sa.Column("target_entity_id", sa.CHAR(36), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=True),
        sa.Column("correlation_type", sa.String(100), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("evidence_chain", sa.JSON(), nullable=True),
        sa.Column("source_records", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_correlations_id", "correlations", ["id"])
    op.create_index("ix_correlations_case_id", "correlations", ["case_id"])
    op.create_index("ix_correlations_correlation_type", "correlations", ["correlation_type"])

    # 5. Intelligence Insights table
    op.create_table(
        "intelligence_insights",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("insight_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("facts", sa.JSON(), nullable=True),
        sa.Column("inferences", sa.JSON(), nullable=True),
        sa.Column("supporting_records", sa.JSON(), nullable=True),
        sa.Column("limitations", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(50), nullable=False, default="MEDIUM"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_intelligence_insights_id", "intelligence_insights", ["id"])
    op.create_index("ix_intelligence_insights_case_id", "intelligence_insights", ["case_id"])
    op.create_index("ix_intelligence_insights_insight_type", "intelligence_insights", ["insight_type"])

    # 6. Anomalies table
    op.create_table(
        "anomalies",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_id", sa.CHAR(36), sa.ForeignKey("entities.id", ondelete="SET NULL"), nullable=True),
        sa.Column("anomaly_type", sa.String(100), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("baseline_value", sa.Float(), nullable=True),
        sa.Column("observed_value", sa.Float(), nullable=True),
        sa.Column("deviation_metric", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, default="REQUIRES_INVESTIGATION"),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_anomalies_id", "anomalies", ["id"])
    op.create_index("ix_anomalies_case_id", "anomalies", ["case_id"])
    op.create_index("ix_anomalies_anomaly_type", "anomalies", ["anomaly_type"])

    # 7. Analysis Jobs table
    op.create_table(
        "analysis_jobs",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, default="QUEUED"),
        sa.Column("progress", sa.Integer(), nullable=False, default=0),
        sa.Column("current_stage", sa.String(100), nullable=False, default="QUEUED"),
        sa.Column("triggered_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("result_summary", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_analysis_jobs_id", "analysis_jobs", ["id"])
    op.create_index("ix_analysis_jobs_case_id", "analysis_jobs", ["case_id"])
    op.create_index("ix_analysis_jobs_status", "analysis_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("analysis_jobs")
    op.drop_table("anomalies")
    op.drop_table("intelligence_insights")
    op.drop_table("correlations")
    op.drop_table("case_similarities")
    op.drop_table("entity_matches")
    op.drop_table("entities")
