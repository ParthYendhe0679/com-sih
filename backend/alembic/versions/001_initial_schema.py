"""Initial platform schema for users, firs, cases, evidence, notifications, and audit logs.

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-07 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Users table
    op.create_table(
        "users",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("phone_number", sa.String(20), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, default="CITIZEN"),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, default=False),
        sa.Column("badge_number", sa.String(50), nullable=True),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("rank", sa.String(100), nullable=True),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_badge_number", "users", ["badge_number"], unique=True)

    # 2. FIRs table
    op.create_table(
        "firs",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("fir_number", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("crime_category", sa.String(100), nullable=False),
        sa.Column("incident_date", sa.Date(), nullable=False),
        sa.Column("incident_time", sa.Time(), nullable=True),
        sa.Column("incident_location", sa.String(255), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, default="DRAFT"),
        sa.Column("priority", sa.String(50), nullable=False, default="MEDIUM"),
        sa.Column("submitted_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewed_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("additional_information", sa.JSON(), nullable=True),
        sa.Column("is_offline", sa.Boolean(), nullable=False, default=False),
        sa.Column("document_name", sa.String(255), nullable=True),
        sa.Column("document_type", sa.String(50), nullable=True),
        sa.Column("document_url", sa.String(500), nullable=True),
        sa.Column("processing_status", sa.String(50), nullable=False, default="NOT_PROCESSED"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_firs_id", "firs", ["id"])
    op.create_index("ix_firs_fir_number", "firs", ["fir_number"], unique=True)
    op.create_index("ix_firs_status", "firs", ["status"])
    op.create_index("ix_firs_priority", "firs", ["priority"])
    op.create_index("ix_firs_crime_category", "firs", ["crime_category"])
    op.create_index("ix_firs_submitted_by_id", "firs", ["submitted_by_id"])
    op.create_index("ix_firs_reviewed_by_id", "firs", ["reviewed_by_id"])

    # 3. Cases table
    op.create_table(
        "cases",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_number", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("crime_category", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, default="OPEN"),
        sa.Column("priority", sa.String(50), nullable=False, default="MEDIUM"),
        sa.Column("fir_id", sa.CHAR(36), sa.ForeignKey("firs.id", ondelete="SET NULL"), unique=True, nullable=True),
        sa.Column("lead_investigator_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cases_id", "cases", ["id"])
    op.create_index("ix_cases_case_number", "cases", ["case_number"], unique=True)
    op.create_index("ix_cases_status", "cases", ["status"])
    op.create_index("ix_cases_priority", "cases", ["priority"])
    op.create_index("ix_cases_crime_category", "cases", ["crime_category"])
    op.create_index("ix_cases_lead_investigator_id", "cases", ["lead_investigator_id"])

    # 4. Case Notes table
    op.create_table(
        "case_notes",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_case_notes_id", "case_notes", ["id"])
    op.create_index("ix_case_notes_case_id", "case_notes", ["case_id"])

    # 5. Evidence table
    op.create_table(
        "evidence",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("case_id", sa.CHAR(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=True),
        sa.Column("fir_id", sa.CHAR(36), sa.ForeignKey("firs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("evidence_type", sa.String(50), nullable=False, default="DOCUMENT"),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_url", sa.String(500), nullable=False),
        sa.Column("file_hash", sa.String(64), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("uploaded_by_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, default="COLLECTED"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_evidence_id", "evidence", ["id"])
    op.create_index("ix_evidence_case_id", "evidence", ["case_id"])
    op.create_index("ix_evidence_fir_id", "evidence", ["fir_id"])
    op.create_index("ix_evidence_file_hash", "evidence", ["file_hash"])

    # 6. Notifications table
    op.create_table(
        "notifications",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(50), nullable=False, default="INFO"),
        sa.Column("is_read", sa.Boolean(), nullable=False, default=False),
        sa.Column("data_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_id", "notifications", ["id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])

    # 7. Audit Logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("old_value", sa.JSON(), nullable=True),
        sa.Column("new_value", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_resource_id", "audit_logs", ["resource_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("notifications")
    op.drop_table("evidence")
    op.drop_table("case_notes")
    op.drop_table("cases")
    op.drop_table("firs")
    op.drop_table("users")
