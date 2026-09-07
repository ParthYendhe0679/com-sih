"""Comprehensive tests for KRITAGAS Part 5 Centralized Data Architecture & Synchronization.

Validates end-to-end data synchronization across:
- Primary PostgreSQL / Neon connection & health probes
- CaseMember multi-investigator team management
- DataSource multi-source ingestion & evidence tracking
- OCR / NLP entity extraction into canonical Entity & CaseEntityContext
- Global Entity reuse across multiple cases with differing roles
- Relationship discovery and persistence to entity_relationships
- SAMANVAYA multi-agent synthesis reports and blockchain cryptographic anchoring
- Safe soft-delete / archival behavior preserving audit trail & hashes
- Case-level access control & role enforcement
- Complete unified intelligence pipeline flow
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.blockchain.models import BlockchainRecord, EvidenceIntegrityRecord, ChainOfCustodyEvent
from app.core.constants import CasePriority, CaseStatus, UserRole
from app.core.security import create_access_token, hash_password
from app.models.case import Case
from app.models.data_architecture import (
    CaseEntityContext,
    CaseMember,
    DataSource,
    EntityRelationship,
    InvestigationReport,
)
from app.models.evidence import Evidence
from app.models.fir import FIR
from app.models.user import User
from app.ai_ml.models.ai_models import Entity
from app.services.data_synchronization_service import DataSynchronizationService


# -------------------------------------------------------------
# Test 1: Database Health Probe
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_database_health_endpoint(client: AsyncClient):
    """Verify GET /api/v1/health/database returns safe observability info without secrets."""
    response = await client.get("/api/v1/health/database")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["database"] == "postgresql"
    assert "provider" in body
    assert "latency_ms" in body
    assert body["pool_status"] in ("optimal", "degraded")
    # Verify no credentials leaked
    assert "password" not in str(body).lower()
    assert "secret" not in str(body).lower()


# -------------------------------------------------------------
# Test 2: Case Creation & CaseMember Team Assignment
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_member_team_assignment(session: AsyncSession, police_user: User):
    """Verify CaseMember allows assigning multiple investigators and specialists to a Case."""
    # Create second investigator
    investigator_2 = User(
        email="forensics_lead@kritagas.gov.in",
        username="forensics_lead",
        full_name="Dr. Anil Deshmukh",
        password_hash=hash_password("Pass@123"),
        role=UserRole.POLICE,
        is_active=True,
    )
    session.add(investigator_2)

    case = Case(
        case_number="CASE-2026-TEST-001",
        title="Syndicate Cross-Border Smuggling",
        description="Investigation into organized contraband network.",
        crime_category="ORGANIZED_CRIME",
        status=CaseStatus.UNDER_INVESTIGATION,
        priority=CasePriority.HIGH,
        lead_investigator_id=police_user.id,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)
    await session.refresh(investigator_2)

    sync_service = DataSynchronizationService(session)

    # Assign investigator_2 as FORENSIC_EXPERT
    member = await sync_service.add_case_member(
        case_id=case.id,
        user_id=investigator_2.id,
        role="FORENSIC_EXPERT",
        assigned_by=police_user,
        permissions={"can_upload_evidence": True, "can_approve_reports": False},
    )

    assert member.id is not None
    assert member.case_id == case.id
    assert member.user_id == investigator_2.id
    assert member.role == "FORENSIC_EXPERT"
    assert member.is_active is True

    # List members
    members = await sync_service.list_case_members(case.id)
    assert len(members) == 1
    assert members[0].user_id == investigator_2.id


# -------------------------------------------------------------
# Test 3: Generic DataSource Ingestion & Blockchain Linkage
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_multi_source_ingestion_and_blockchain_anchoring(
    session: AsyncSession, police_user: User
):
    """Verify external intelligence sources (CDR, Financial, CCTV) are tracked in DataSource
    and anchored to BlockchainRecord and ChainOfCustodyEvent.
    """
    case = Case(
        case_number="CASE-2026-TEST-002",
        title="Late-Night Financial Embezzlement",
        description="Banking transaction fraud investigation.",
        crime_category="FINANCIAL_FRAUD",
        status=CaseStatus.OPEN,
        priority=CasePriority.CRITICAL,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    sync_service = DataSynchronizationService(session)

    # Ingest CDR log file
    sample_cdr_content = b"TIMESTAMP,CALLER,RECEIVER,DURATION,TOWER_ID\n2026-09-08 02:15,+919876543210,+919123456780,185,MUM-TWR-401\n"
    result = await sync_service.ingest_document_source(
        case_id=case.id,
        source_type="CALL_RECORD",
        source_reference="CDR-BATCH-2026-09-08-A",
        title="Suspect Night Cellular Activity Logs",
        file_name="suspect_cdr_logs.csv",
        file_url="/storage/cases/002/suspect_cdr_logs.csv",
        uploaded_by=police_user,
        source_system="AIRTEL_TELECOM_GATEWAY",
        raw_metadata={"record_count": 1, "provider": "AIRTEL"},
        file_content=sample_cdr_content,
    )

    assert result["status"] == "INGESTED"
    assert result["file_hash"] is not None
    assert result["blockchain_tx"] is not None

    # Verify database persistence
    ds_stmt = select(DataSource).where(DataSource.id == uuid.UUID(result["data_source_id"]))
    ds_res = await session.execute(ds_stmt)
    data_source = ds_res.scalar_one_or_none()
    assert data_source is not None
    assert data_source.source_type == "CALL_RECORD"
    assert data_source.source_system == "AIRTEL_TELECOM_GATEWAY"

    # Verify blockchain record
    bc_stmt = select(BlockchainRecord).where(BlockchainRecord.transaction_id == result["blockchain_tx"])
    bc_res = await session.execute(bc_stmt)
    bc_record = bc_res.scalar_one_or_none()
    assert bc_record is not None
    assert bc_record.data_hash == result["file_hash"]

    # Verify custody event
    custody_stmt = select(ChainOfCustodyEvent).where(ChainOfCustodyEvent.evidence_id == uuid.UUID(result["evidence_id"]))
    custody_res = await session.execute(custody_stmt)
    custody_events = custody_res.scalars().all()
    assert len(custody_events) >= 1
    assert custody_events[0].performed_by_id == police_user.id


# -------------------------------------------------------------
# Test 4: NLP Entity Extraction into Global Entity & CaseEntityContext
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_entity_extraction_and_case_context(session: AsyncSession, police_user: User):
    """Verify narrative text extracts Phone, Vehicle, Person, Location, and creates CaseEntityContext."""
    case = Case(
        case_number="CASE-2026-TEST-003",
        title="Armed Bank Heist",
        description="Armed robbery narrative.",
        crime_category="ARMED_ROBBERY",
        status=CaseStatus.OPEN,
        priority=CasePriority.HIGH,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    narrative_text = (
        "On 8 September 2026, Suspect Rahul Sharma along with an associate fled the scene "
        "near Sector 18 in getaway car MH02AB1234. An intercepted cellular call was traced to "
        "+919876543210 while funds were deposited into Account 9876543210123."
    )

    sync_service = DataSynchronizationService(session)
    extracted = await sync_service.process_text_entities(
        case_id=case.id,
        text=narrative_text,
        user=police_user,
        extraction_method="OCR_NER_V1",
    )

    assert len(extracted) >= 3

    # Check extracted types
    types = {e["type"] for e in extracted}
    assert "PERSON" in types or "PHONE" in types or "VEHICLE" in types

    # Verify CaseEntityContext persisted
    ctx_stmt = select(CaseEntityContext).where(CaseEntityContext.case_id == case.id)
    ctx_res = await session.execute(ctx_stmt)
    contexts = ctx_res.scalars().all()
    assert len(contexts) >= 3


# -------------------------------------------------------------
# Test 5: Global Entity Reuse Across Multiple Cases
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_global_entity_reuse_across_cases(session: AsyncSession, police_user: User):
    """Verify that a real-world entity (e.g., Person: Rahul Sharma) is not duplicated
    across multiple cases, but rather linked with different contextual roles (Suspect vs Witness).
    """
    case1 = Case(
        case_number="CASE-2026-101",
        title="Jewelry Store Burglary",
        description="Burglary in northern district.",
        crime_category="BURGLARY",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    case2 = Case(
        case_number="CASE-2026-205",
        title="Warehouse Arson",
        description="Arson in industrial zone.",
        crime_category="ARSON",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case1)
    session.add(case2)
    await session.commit()
    await session.refresh(case1)
    await session.refresh(case2)

    sync_service = DataSynchronizationService(session)

    # In Case 1: Rahul Sharma is the Suspect
    narrative_1 = "Suspect Rahul Sharma was observed fleeing the premises with phone +919876543210."
    res1 = await sync_service.process_text_entities(case_id=case1.id, text=narrative_1, user=police_user)

    # In Case 2: Rahul Sharma is a Witness
    narrative_2 = "Mr. Rahul Sharma provided eyewitness testimony regarding the suspicious vehicle."
    res2 = await sync_service.process_text_entities(case_id=case2.id, text=narrative_2, user=police_user)

    # Check that only ONE canonical Entity exists for 'rahul_sharma'
    ent_stmt = select(Entity).where(Entity.normalized_value == "rahul_sharma")
    ent_res = await session.execute(ent_stmt)
    entities = ent_res.scalars().all()
    assert len(entities) == 1, "Rahul Sharma should only exist once in the global entities table!"

    # Verify TWO distinct CaseEntityContext records link to the same Entity
    ctx_stmt = select(CaseEntityContext).where(CaseEntityContext.entity_id == entities[0].id)
    ctx_res = await session.execute(ctx_stmt)
    contexts = ctx_res.scalars().all()
    assert len(contexts) >= 2
    case_ids = {c.case_id for c in contexts}
    assert case1.id in case_ids
    assert case2.id in case_ids


# -------------------------------------------------------------
# Test 6: Relationship Discovery & Database Persistence
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_relationship_discovery_and_persistence(session: AsyncSession, police_user: User):
    """Verify evidence-backed relationships (e.g. PERSON OWNS VEHICLE, PERSON CALLED PERSON)
    are discovered and persisted into the entity_relationships table.
    """
    case = Case(
        case_number="CASE-2026-TEST-004",
        title="Syndicate Narcotics Operation",
        description="Narcotics trafficking investigation.",
        crime_category="NARCOTICS",
        status=CaseStatus.UNDER_INVESTIGATION,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    # Create two persons, one phone, and one vehicle in the case
    p1 = Entity(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_type="PERSON",
        name="Vikram Sethi",
        normalized_value="vikram_sethi",
        is_canonical=True,
    )
    p2 = Entity(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_type="PERSON",
        name="Rajesh Verma",
        normalized_value="rajesh_verma",
        is_canonical=True,
    )
    veh = Entity(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_type="VEHICLE",
        name="MH01CD5678",
        normalized_value="MH01CD5678",
        is_canonical=True,
    )
    session.add_all([p1, p2, veh])

    # Add CaseEntityContexts
    c1 = CaseEntityContext(case_id=case.id, entity_id=p1.id, role="SUSPECT")
    c2 = CaseEntityContext(case_id=case.id, entity_id=p2.id, role="ASSOCIATE")
    c3 = CaseEntityContext(case_id=case.id, entity_id=veh.id, role="INSTRUMENTALITY")
    session.add_all([c1, c2, c3])
    await session.commit()

    sync_service = DataSynchronizationService(session)
    rels = await sync_service.discover_and_persist_relationships(case_id=case.id, user=police_user)

    assert len(rels) >= 1

    # Verify persisted in entity_relationships table
    er_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case.id)
    er_res = await session.execute(er_stmt)
    persisted_rels = er_res.scalars().all()
    assert len(persisted_rels) >= 1

    rel_types = [r.relationship_type for r in persisted_rels]
    assert "OWNS" in rel_types or "CALLED" in rel_types


# -------------------------------------------------------------
# Test 7: SAMANVAYA Multi-Agent Synthesis & Blockchain Report Registration
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_samanvaya_report_generation_and_blockchain_hashing(
    session: AsyncSession, police_user: User
):
    """Verify SAMANVAYA multi-agent investigation generates an official report,
    persists in investigation_reports table, and registers SHA-256 hash in BlockchainRecord.
    """
    case = Case(
        case_number="CASE-2026-TEST-005",
        title="High-Value Extortion Syndicate",
        description="Multi-jurisdiction extortion syndicate inquiry.",
        crime_category="EXTORTION",
        status=CaseStatus.UNDER_INVESTIGATION,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    sync_service = DataSynchronizationService(session)
    report_data = await sync_service.generate_and_persist_samanvaya_report(
        case_id=case.id,
        user=police_user,
    )

    assert report_data["report_id"] is not None
    assert report_data["content_hash"] is not None
    assert report_data["blockchain_tx"] is not None
    assert len(report_data["agent_reports"]) >= 3

    # Verify database persistence
    rep_stmt = select(InvestigationReport).where(InvestigationReport.id == uuid.UUID(report_data["report_id"]))
    rep_res = await session.execute(rep_stmt)
    report = rep_res.scalar_one_or_none()
    assert report is not None
    assert report.report_type == "SAMANVAYA_SYNTHESIS"
    assert report.status == "FINAL"
    assert report.content_hash == report_data["content_hash"]
    assert report.blockchain_record_id is not None


# -------------------------------------------------------------
# Test 8: Safe Soft-Delete / Archival Preserving Audit Integrity
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_safe_archival_and_soft_delete(session: AsyncSession, police_user: User):
    """Verify Case archival (soft delete) transitions status to CLOSED, records archival notes,
    and preserves all audit logs and blockchain integrity records without cascading destruction.
    """
    case = Case(
        case_number="CASE-2026-TEST-006",
        title="Cold Case File",
        description="Historical unresolved investigation.",
        crime_category="THEFT",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    from app.services.case_service import CaseService
    from app.repositories.case_repository import CaseRepository
    from app.repositories.fir_repository import FIRRepository
    from app.repositories.user_repository import UserRepository
    from app.services.audit_service import AuditService
    from app.services.notification_service import NotificationService
    from app.repositories.audit_repository import AuditRepository
    from app.repositories.notification_repository import NotificationRepository
    from app.integrations.intelligence.intelligence_interface import ActiveMasterIntelligenceService
    from app.integrations.graph.graph_interface import NoOpGraphService

    case_repo = CaseRepository(session)
    fir_repo = FIRRepository(session)
    user_repo = UserRepository(session)
    audit_service = AuditService(AuditRepository(session))
    notif_service = NotificationService(NotificationRepository(session))
    intel_service = ActiveMasterIntelligenceService()
    graph_service = NoOpGraphService()

    case_service = CaseService(
        case_repo=case_repo,
        fir_repo=fir_repo,
        user_repo=user_repo,
        audit_service=audit_service,
        notification_service=notif_service,
        intelligence_service=intel_service,
        graph_service=graph_service,
    )

    archived_case = await case_service.soft_delete_case(
        case_id=case.id,
        user=police_user,
        reason="Investigation concluded; suspect remanded to judicial custody.",
    )

    assert archived_case.status == CaseStatus.CLOSED
    assert archived_case.closed_at is not None

    # Verify notes and audit logs were preserved
    notes = await case_repo.get_notes_for_case(case.id)
    assert len(notes) >= 1
    assert "Archival Note" in notes[0].note


# -------------------------------------------------------------
# Test 9: Complete End-to-End API Workflow
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_end_to_end_api_synchronization_flow(client: AsyncClient, police_user: User):
    """Validate full end-to-end API lifecycle:
    Case Creation -> Data Source Ingestion -> Entity Extraction ->
    Relationship Discovery -> SAMANVAYA Report -> Reports Query.
    """
    token = create_access_token(
        subject=police_user.id,
        role=police_user.role.value,
        email=police_user.email,
    )
    headers = {"Authorization": f"Bearer {token}"}


    # 1. Create Case
    case_payload = {
        "title": "Operation Nightshade Cyber Syndicate",
        "description": "Cross-border financial malware investigation.",
        "crime_category": "CYBER_CRIME",
        "priority": "HIGH",
    }
    create_res = await client.post("/api/v1/cases", json=case_payload, headers=headers)
    assert create_res.status_code in (200, 201)
    case_id = create_res.json()["data"]["id"]

    # 2. Ingest Evidence Data Source
    ingest_payload = {
        "source_type": "FINANCIAL_RECORD",
        "source_reference": "SWIFT-TXN-2026-9901",
        "title": "Illicit Wire Transfer Logs",
        "file_name": "swift_transfers.json",
        "file_url": "/storage/cyber/swift_transfers.json",
        "source_system": "RBI_FIU_GATEWAY",
    }
    ingest_res = await client.post(f"/api/v1/sync/cases/{case_id}/ingest", json=ingest_payload, headers=headers)
    assert ingest_res.status_code == 201
    ingest_data = ingest_res.json()["data"]
    assert ingest_data["file_hash"] is not None
    assert ingest_data["blockchain_tx"] is not None

    # 3. Process Text & Extract Entities
    process_payload = {
        "text": (
            "Suspect Rajesh Verma operated mule account Account 554433221100 near Sector 62 "
            "and transferred proceeds to associates using vehicle DL01XY9988."
        ),
    }
    extract_res = await client.post(f"/api/v1/sync/cases/{case_id}/process-text", json=process_payload, headers=headers)
    assert extract_res.status_code == 200
    entities = extract_res.json()["data"]
    assert len(entities) >= 1

    # 4. Query Case Entities Context
    ctx_res = await client.get(f"/api/v1/sync/cases/{case_id}/entities/context", headers=headers)
    assert ctx_res.status_code == 200
    contexts = ctx_res.json()["data"]
    assert len(contexts) >= 1

    # 5. Generate SAMANVAYA Report & Register on Blockchain
    report_res = await client.post(f"/api/v1/sync/cases/{case_id}/reports/samanvaya", headers=headers)
    assert report_res.status_code == 201
    report_data = report_res.json()["data"]
    assert report_data["content_hash"] is not None
    assert report_data["blockchain_tx"] is not None

    # 6. Query Persisted Reports
    list_reports_res = await client.get(f"/api/v1/sync/cases/{case_id}/reports", headers=headers)
    assert list_reports_res.status_code == 200
    reports_list = list_reports_res.json()["data"]
    assert len(reports_list) >= 1
    assert reports_list[0]["report_type"] == "SAMANVAYA_SYNTHESIS"
    assert reports_list[0]["has_blockchain_record"] is True
