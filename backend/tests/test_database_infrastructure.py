"""Tests for database infrastructure, session management, constraints, and health probes."""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AuditAction,
    CasePriority,
    CaseStatus,
    EvidenceStatus,
    EvidenceType,
    FIRPriority,
    FIRStatus,
    UserRole,
)
from app.core.security import hash_password
from app.db.init_db import check_db_connection, check_db_readiness
from app.db.session import dispose_engine
from app.models.audit_log import AuditLog
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.fir import FIR
from app.models.user import User


@pytest.mark.asyncio
async def test_database_connection_and_readiness(session: AsyncSession):
    """Verify check_db_connection and latency-aware check_db_readiness utilities."""
    is_connected = await check_db_connection(session)
    assert is_connected is True

    readiness = await check_db_readiness(session)
    assert readiness["status"] == "connected"
    assert readiness["latency_ms"] is not None
    assert readiness["latency_ms"] >= 0.0


@pytest.mark.asyncio
async def test_engine_disposal():
    """Verify dispose_engine coroutine executes safely without exceptions."""
    await dispose_engine()


@pytest.mark.asyncio
async def test_duplicate_email_prevention(client: AsyncClient, citizen_user: User):
    """Verify database unique constraint prevents duplicate user email registration."""
    payload = {
        "email": citizen_user.email,  # Duplicate
        "username": "unique_username_99",
        "full_name": "Duplicate Tester",
        "password": "Password@123",
        "phone_number": "+91-9876543210",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    body = response.json()
    assert body["success"] is False
    assert "CONFLICT" in body["error"]["code"]


@pytest.mark.asyncio
async def test_duplicate_username_prevention(client: AsyncClient, citizen_user: User):
    """Verify database unique constraint prevents duplicate username registration."""
    payload = {
        "email": "unique_email_99@example.com",
        "username": citizen_user.username,  # Duplicate
        "full_name": "Duplicate Tester 2",
        "password": "Password@123",
        "phone_number": "+91-9876543210",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    body = response.json()
    assert body["success"] is False
    assert "CONFLICT" in body["error"]["code"]



@pytest.mark.asyncio
async def test_evidence_orphan_prevention(session: AsyncSession, police_user: User):
    """Verify Evidence CheckConstraint requires at least one parent (case_id or fir_id)."""
    orphan_evidence = Evidence(
        case_id=None,
        fir_id=None,
        title="Orphan File",
        evidence_type=EvidenceType.DOCUMENT,
        file_name="orphan.pdf",
        file_url="/uploads/orphan.pdf",
        uploaded_by_id=police_user.id,
        status=EvidenceStatus.COLLECTED,
    )
    session.add(orphan_evidence)
    with pytest.raises(IntegrityError):
        await session.flush()
    await session.rollback()


@pytest.mark.asyncio
async def test_audit_log_persists_on_user_deletion(session: AsyncSession):
    """Verify AuditLog foreign key ondelete='SET NULL' preserves audit trails."""
    # Create temporary user
    temp_user = User(
        email=f"audit_temp_{uuid.uuid4().hex[:8]}@example.com",
        username=f"audit_user_{uuid.uuid4().hex[:8]}",
        full_name="Temp Audit User",
        password_hash=hash_password("Pass@123456"),
        role=UserRole.POLICE,
    )
    session.add(temp_user)
    await session.flush()

    # Log action for temporary user
    log = AuditLog(
        user_id=temp_user.id,
        action=AuditAction.USER_LOGIN.value,
        resource_type="user",
        resource_id=str(temp_user.id),
        description="Temp user login",
        ip_address="127.0.0.1",
    )
    session.add(log)
    await session.flush()
    log_id = log.id

    # Delete user
    await session.delete(temp_user)
    await session.flush()

    # Verify audit log still exists with user_id SET NULL
    refetched_log = (await session.execute(select(AuditLog).where(AuditLog.id == log_id))).scalar_one_or_none()
    assert refetched_log is not None
    assert refetched_log.user_id is None
    assert refetched_log.action == AuditAction.USER_LOGIN.value


@pytest.mark.asyncio
async def test_health_check_endpoint(client: AsyncClient):
    """Verify GET /api/v1/health returns standardized health envelope."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "healthy"
    assert data["services"]["database"] == "connected"


@pytest.mark.asyncio
async def test_readiness_probe_endpoint(client: AsyncClient):
    """Verify GET /api/v1/health/ready returns detailed readiness telemetry."""
    response = await client.get("/api/v1/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "ready"
    assert data["services"]["database"]["status"] == "connected"
    assert data["services"]["database"]["latency_ms"] is not None
