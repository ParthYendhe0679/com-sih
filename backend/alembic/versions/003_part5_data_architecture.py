"""Part 5 Centralized Data Architecture & Blockchain synchronization schema.

Creates tables for:
- BlockchainRecords, EvidenceIntegrityRecords, ChainOfCustodyEvents, InvestigationAuditRecords
- CaseMembers, DataSources, CaseEntityContexts, EntityRelationships, InvestigationReports

Revision ID: 003_part5_data_architecture
Revises: 002_ai_ml_intelligence
Create Date: 2026-09-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "003_part5_data_architecture"
down_revision: Union[str, None] = "002_ai_ml_intelligence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Blockchain Records table
    op.create_table(
        "blockchain_records",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("record_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="SET NULL"), nullable=True),
        sa.Column("data_hash", sa.String(64), nullable=False),
        sa.Column("previous_hash", sa.String(64), nullable=True),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("transaction_id", sa.String(100), unique=True, nullable=False),
        sa.Column("provider", sa.String(30), nullable=False, default="mock"),
        sa.Column("status", sa.String(20), nullable=False, default="REGISTERED"),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_blockchain_records_id", "blockchain_records", ["id"])
    op.create_index("ix_blockchain_records_record_type", "blockchain_records", ["record_type"])
    op.create_index("ix_blockchain_records_entity_type", "blockchain_records", ["entity_type"])
    op.create_index("ix_blockchain_records_entity_id", "blockchain_records", ["entity_id"])
    op.create_index("ix_blockchain_records_case_id", "blockchain_records", ["case_id"])
    op.create_index("ix_blockchain_records_data_hash", "blockchain_records", ["data_hash"])
    op.create_index("ix_blockchain_records_block_number", "blockchain_records", ["block_number"])
    op.create_index("ix_blockchain_records_transaction_id", "blockchain_records", ["transaction_id"], unique=True)
    op.create_index("ix_blockchain_records_status", "blockchain_records", ["status"])

    # 2. Evidence Integrity Records table
    op.create_table(
        "evidence_integrity_records",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("evidence_id", sa.CHAR(36), sa.ForeignKey("evidence.id", ondelete="CASCADE"), nullable=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="SET NULL"), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False, default="EVIDENCE"),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("original_hash", sa.String(64), nullable=False),
        sa.Column("verification_status", sa.String(20), nullable=False, default="REGISTERED"),
        sa.Column("blockchain_record_id", sa.CHAR(36), sa.ForeignKey("blockchain_records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_evidence_integrity_records_id", "evidence_integrity_records", ["id"])
    op.create_index("ix_evidence_integrity_records_evidence_id", "evidence_integrity_records", ["evidence_id"])
    op.create_index("ix_evidence_integrity_records_case_id", "evidence_integrity_records", ["case_id"])
    op.create_index("ix_evidence_integrity_records_entity_id", "evidence_integrity_records", ["entity_id"])
    op.create_index("ix_evidence_integrity_records_verification_status", "evidence_integrity_records", ["verification_status"])
    op.create_index("ix_evidence_integrity_records_blockchain_record_id", "evidence_integrity_records", ["blockchain_record_id"])

    # 3. Chain of Custody Events table
    op.create_table(
        "chain_of_custody_events",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("evidence_id", sa.CHAR(36), sa.ForeignKey("evidence.id", ondelete="CASCADE"), nullable=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="SET NULL"), nullable=True),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("performed_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("previous_custodian_id", sa.CHAR(36), nullable=True),
        sa.Column("new_custodian_id", sa.CHAR(36), nullable=True),
        sa.Column("event_hash", sa.String(64), nullable=False),
        sa.Column("previous_event_hash", sa.String(64), nullable=True),
        sa.Column("blockchain_record_id", sa.CHAR(36), sa.ForeignKey("blockchain_records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chain_of_custody_events_id", "chain_of_custody_events", ["id"])
    op.create_index("ix_chain_of_custody_events_evidence_id", "chain_of_custody_events", ["evidence_id"])
    op.create_index("ix_chain_of_custody_events_case_id", "chain_of_custody_events", ["case_id"])
    op.create_index("ix_chain_of_custody_events_entity_id", "chain_of_custody_events", ["entity_id"])
    op.create_index("ix_chain_of_custody_events_event_type", "chain_of_custody_events", ["event_type"])
    op.create_index("ix_chain_of_custody_events_performed_by_id", "chain_of_custody_events", ["performed_by_id"])
    op.create_index("ix_chain_of_custody_events_timestamp", "chain_of_custody_events", ["timestamp"])

    # 4. Investigation Audit Records table
    op.create_table(
        "investigation_audit_records",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="SET NULL"), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("actor_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_role", sa.String(20), nullable=True),
        sa.Column("data_hash", sa.String(64), nullable=False),
        sa.Column("previous_hash", sa.String(64), nullable=True),
        sa.Column("blockchain_record_id", sa.CHAR(36), sa.ForeignKey("blockchain_records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_investigation_audit_records_id", "investigation_audit_records", ["id"])
    op.create_index("ix_investigation_audit_records_case_id", "investigation_audit_records", ["case_id"])
    op.create_index("ix_investigation_audit_records_entity_type", "investigation_audit_records", ["entity_type"])
    op.create_index("ix_investigation_audit_records_entity_id", "investigation_audit_records", ["entity_id"])
    op.create_index("ix_investigation_audit_records_action", "investigation_audit_records", ["action"])
    op.create_index("ix_investigation_audit_records_actor_id", "investigation_audit_records", ["actor_id"])
    op.create_index("ix_investigation_audit_records_timestamp", "investigation_audit_records", ["timestamp"])

    # 5. Case Members table
    op.create_table(
        "case_members",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, default="INVESTIGATOR"),
        sa.Column("assigned_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("permissions_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("case_id", "user_id", name="uq_case_member"),
    )
    op.create_index("ix_case_members_id", "case_members", ["id"])
    op.create_index("ix_case_members_case_id", "case_members", ["case_id"])
    op.create_index("ix_case_members_user_id", "case_members", ["user_id"])
    op.create_index("ix_case_members_role", "case_members", ["role"])

    # 6. Data Sources table
    op.create_table(
        "data_sources",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=True),
        sa.Column("fir_id", sa.CHAR(36), sa.ForeignKey("firs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("evidence_id", sa.CHAR(36), sa.ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_reference", sa.String(255), nullable=False),
        sa.Column("source_system", sa.String(100), nullable=True),
        sa.Column("uploaded_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("processing_status", sa.String(50), nullable=False, default="PENDING"),
        sa.Column("raw_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_data_sources_id", "data_sources", ["id"])
    op.create_index("ix_data_sources_source_type", "data_sources", ["source_type"])
    op.create_index("ix_data_sources_case_id", "data_sources", ["case_id"])
    op.create_index("ix_data_sources_fir_id", "data_sources", ["fir_id"])
    op.create_index("ix_data_sources_evidence_id", "data_sources", ["evidence_id"])
    op.create_index("ix_data_sources_source_reference", "data_sources", ["source_reference"])
    op.create_index("ix_data_sources_uploaded_by_id", "data_sources", ["uploaded_by_id"])
    op.create_index("ix_data_sources_processing_status", "data_sources", ["processing_status"])

    # 7. Case Entity Contexts table
    op.create_table(
        "case_entity_contexts",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_id", sa.CHAR(36), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, default="PERSON_OF_INTEREST"),
        sa.Column("fir_id", sa.CHAR(36), sa.ForeignKey("firs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_evidence_id", sa.CHAR(36), sa.ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False, default=1.0),
        sa.Column("extraction_method", sa.String(50), nullable=False, default="MANUAL_ENTRY"),
        sa.Column("original_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, default="EXTRACTED"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("case_id", "entity_id", "role", name="uq_case_entity_role"),
    )
    op.create_index("ix_case_entity_contexts_id", "case_entity_contexts", ["id"])
    op.create_index("ix_case_entity_contexts_case_id", "case_entity_contexts", ["case_id"])
    op.create_index("ix_case_entity_contexts_entity_id", "case_entity_contexts", ["entity_id"])
    op.create_index("ix_case_entity_contexts_role", "case_entity_contexts", ["role"])
    op.create_index("ix_case_entity_contexts_fir_id", "case_entity_contexts", ["fir_id"])
    op.create_index("ix_case_entity_contexts_source_evidence_id", "case_entity_contexts", ["source_evidence_id"])
    op.create_index("ix_case_entity_contexts_status", "case_entity_contexts", ["status"])

    # 8. Entity Relationships table
    op.create_table(
        "entity_relationships",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("source_entity_id", sa.CHAR(36), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_entity_id", sa.CHAR(36), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_type", sa.String(60), nullable=False),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False, default=1.0),
        sa.Column("source_evidence_id", sa.CHAR(36), sa.ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True),
        sa.Column("extraction_method", sa.String(60), nullable=False, default="NLP_DEPENDENCY_PARSE"),
        sa.Column("created_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, default="DETECTED"),
        sa.Column("evidence_chain", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_entity_relationships_id", "entity_relationships", ["id"])
    op.create_index("ix_entity_relationships_source_entity_id", "entity_relationships", ["source_entity_id"])
    op.create_index("ix_entity_relationships_target_entity_id", "entity_relationships", ["target_entity_id"])
    op.create_index("ix_entity_relationships_relationship_type", "entity_relationships", ["relationship_type"])
    op.create_index("ix_entity_relationships_case_id", "entity_relationships", ["case_id"])
    op.create_index("ix_entity_relationships_status", "entity_relationships", ["status"])

    # 9. Investigation Reports table
    op.create_table(
        "investigation_reports",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(60), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("content_json", sa.JSON(), nullable=True),
        sa.Column("generated_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("agent_name", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, default="FINAL"),
        sa.Column("blockchain_record_id", sa.CHAR(36), sa.ForeignKey("blockchain_records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_investigation_reports_id", "investigation_reports", ["id"])
    op.create_index("ix_investigation_reports_case_id", "investigation_reports", ["case_id"])
    op.create_index("ix_investigation_reports_report_type", "investigation_reports", ["report_type"])
    op.create_index("ix_investigation_reports_generated_by_id", "investigation_reports", ["generated_by_id"])
    op.create_index("ix_investigation_reports_blockchain_record_id", "investigation_reports", ["blockchain_record_id"])
    op.create_index("ix_investigation_reports_content_hash", "investigation_reports", ["content_hash"])


def downgrade() -> None:
    op.drop_table("investigation_reports")
    op.drop_table("entity_relationships")
    op.drop_table("case_entity_contexts")
    op.drop_table("data_sources")
    op.drop_table("case_members")
    op.drop_table("investigation_audit_records")
    op.drop_table("chain_of_custody_events")
    op.drop_table("evidence_integrity_records")
    op.drop_table("blockchain_records")
