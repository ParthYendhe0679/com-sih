"""Comprehensive test suite for KRITAGAS Blockchain Evidence Integrity module.

Covers:
1. Hash service (SHA-256 deterministic computation and verification)
2. Mock blockchain provider (block numbers, hash chaining, verification, health)
3. Ethereum placeholder provider (graceful NotImplementedError)
4. Chain of custody (events, chaining, tamper/broken chain detection)
5. Investigation audit service (audit logging, chaining, verification)
6. Integrity service (evidence registration, tamper detection, case summary)
7. Blockchain REST API endpoints & role-based access control
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.blockchain.constants import (
    BlockchainMode,
    BlockchainRecordStatus,
    CustodyEventType,
    EntityType,
    IntegrityStatus,
    InvestigationAuditAction,
    RecordType,
)
from app.blockchain.models import (
    BlockchainRecord,
    ChainOfCustodyEvent,
    EvidenceIntegrityRecord,
    InvestigationAuditRecord,
)
from app.blockchain.providers.ethereum_provider import EthereumBlockchainProvider
from app.blockchain.providers.mock_provider import MockBlockchainProvider
from app.blockchain.repository import BlockchainRepository
from app.blockchain.services.blockchain_service import BlockchainService
from app.blockchain.services.custody_service import ChainOfCustodyService
from app.blockchain.services.hash_service import EvidenceHashService
from app.blockchain.services.integrity_service import IntegrityService
from app.blockchain.services.investigation_audit_service import InvestigationAuditService
from app.core.constants import CasePriority, CaseStatus, CrimeCategory, EvidenceStatus, EvidenceType, UserRole
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.user import User


# ==============================================================================
# 1. EvidenceHashService Unit Tests
# ==============================================================================

class TestEvidenceHashService:
    def test_hash_bytes_deterministic(self):
        data = b"Sample forensic document binary content"
        hash1 = EvidenceHashService.hash_bytes(data)
        hash2 = EvidenceHashService.hash_bytes(data)
        assert hash1 == hash2
        assert len(hash1) == 64
        assert hash1 != EvidenceHashService.hash_bytes(b"Modified content")

    def test_hash_text_deterministic(self):
        text = "Confidential FIR report text description"
        hash1 = EvidenceHashService.hash_text(text)
        hash2 = EvidenceHashService.hash_text(text)
        assert hash1 == hash2
        assert len(hash1) == 64
        assert hash1 != EvidenceHashService.hash_text("Confidential FIR report text description.")

    def test_hash_json_key_order_invariant(self):
        dict1 = {"evidence_id": "123", "officer": "Ramesh", "timestamp": "2026-09-08"}
        dict2 = {"timestamp": "2026-09-08", "evidence_id": "123", "officer": "Ramesh"}
        hash1 = EvidenceHashService.hash_json(dict1)
        hash2 = EvidenceHashService.hash_json(dict2)
        assert hash1 == hash2
        assert len(hash1) == 64

    def test_verify_hash(self):
        data = b"Ballistics report page 1"
        computed = EvidenceHashService.hash_bytes(data)
        assert EvidenceHashService.verify_hash(data, computed) is True
        assert EvidenceHashService.verify_hash(b"Tampered report", computed) is False

    def test_hash_evidence_metadata(self):
        h1 = EvidenceHashService.hash_evidence_metadata(
            evidence_id="ev-001",
            file_hash="a" * 64,
            title="CCTV Footage",
            evidence_type="VIDEO",
            file_name="cam01.mp4",
        )
        assert len(h1) == 64

        # Changing title changes hash
        h2 = EvidenceHashService.hash_evidence_metadata(
            evidence_id="ev-001",
            file_hash="a" * 64,
            title="CCTV Footage Modified",
            evidence_type="VIDEO",
            file_name="cam01.mp4",
        )
        assert h1 != h2


# ==============================================================================
# 2. MockBlockchainProvider Unit Tests
# ==============================================================================

class TestMockBlockchainProvider:
    @pytest.mark.asyncio
    async def test_register_hash_and_block_increments(self):
        provider = MockBlockchainProvider()
        await provider.initialize()

        data_hash = EvidenceHashService.hash_text("Evidence 1")
        tx1 = await provider.register_hash(
            data_hash=data_hash,
            entity_type=EntityType.EVIDENCE.value,
            entity_id="ev-001",
        )

        assert tx1.transaction_id.startswith("mock_tx_")
        assert tx1.data_hash == data_hash
        assert tx1.block_number >= 1

        # Second registration should increment block and link previous hash
        data_hash_2 = EvidenceHashService.hash_text("Evidence 2")
        tx2 = await provider.register_hash(
            data_hash=data_hash_2,
            entity_type=EntityType.EVIDENCE.value,
            entity_id="ev-002",
        )

        assert tx2.block_number == tx1.block_number + 1
        assert tx2.previous_hash is not None

    @pytest.mark.asyncio
    async def test_verify_hash_on_provider(self):
        provider = MockBlockchainProvider()
        await provider.initialize()

        test_hash = EvidenceHashService.hash_text("FIR-1001-Hash")
        tx = await provider.register_hash(
            data_hash=test_hash,
            entity_type=EntityType.FIR.value,
            entity_id="fir-1001",
        )

        is_valid = await provider.verify_hash(tx.transaction_id, test_hash)
        assert is_valid is True

        is_invalid = await provider.verify_hash(tx.transaction_id, "0" * 64)
        assert is_invalid is False

    @pytest.mark.asyncio
    async def test_get_transaction_and_health(self):
        provider = MockBlockchainProvider()
        await provider.initialize()

        tx = await provider.register_hash("abcdef" * 10 + "1234", EntityType.CASE.value, "case-01")
        retrieved = await provider.get_transaction(tx.transaction_id)
        assert retrieved is not None
        assert retrieved.transaction_id == tx.transaction_id

        health = await provider.health_check()
        assert health.status == "healthy"
        assert health.provider == "mock"
        assert health.block_height >= 1


# ==============================================================================
# 3. Ethereum Placeholder Provider Tests
# ==============================================================================

class TestEthereumProvider:
    @pytest.mark.asyncio
    async def test_ethereum_provider_raises_not_implemented(self):
        eth_provider = EthereumBlockchainProvider(
            rpc_url="http://localhost:8545",
            private_key="0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            contract_address="0x1234567890123456789012345678901234567890",
        )
        with pytest.raises(NotImplementedError) as exc_info:
            await eth_provider.register_hash("hash123", "evidence", "id-1")
        assert "Ethereum provider not implemented" in str(exc_info.value)


# ==============================================================================
# 4. ChainOfCustodyService Tests
# ==============================================================================

class TestChainOfCustodyService:
    @pytest.mark.asyncio
    async def test_custody_chain_and_tamper_detection(self, session: AsyncSession, police_user: User):
        repo = BlockchainRepository(session)
        bc_service = BlockchainService(repo)
        custody_service = ChainOfCustodyService(repo, bc_service)

        evidence_id = str(uuid.uuid4())

        # Event 1: Creation/Upload
        e1 = await custody_service.create_event(
            entity_id=evidence_id,
            event_type=CustodyEventType.EVIDENCE_UPLOADED.value,
            description="Collected from crime scene",
            performed_by_id=police_user.id,
            new_custodian_id=police_user.id,
        )
        assert e1.previous_event_hash is None
        assert len(e1.event_hash) == 64

        # Event 2: Transferred to forensics lab
        lab_officer_id = uuid.uuid4()
        e2 = await custody_service.create_event(
            entity_id=evidence_id,
            event_type=CustodyEventType.EVIDENCE_TRANSFERRED.value,
            description="Transferred to State Forensic Science Laboratory",
            performed_by_id=police_user.id,
            previous_custodian_id=police_user.id,
            new_custodian_id=lab_officer_id,
        )
        assert e2.previous_event_hash == e1.event_hash

        # Event 3: Analyzed
        e3 = await custody_service.create_event(
            entity_id=evidence_id,
            event_type=CustodyEventType.EVIDENCE_ANALYZED.value,
            description="Forensic chemical analysis completed",
            performed_by_id=police_user.id,
        )
        assert e3.previous_event_hash == e2.event_hash

        # Verify intact chain
        verification = await custody_service.verify_chain(evidence_id)
        assert verification["valid"] is True
        assert verification["total_events"] == 3

        # Tamper detection: artificially corrupt e2 hash in DB
        e2.event_hash = "f" * 64
        await session.commit()

        tampered_check = await custody_service.verify_chain(evidence_id)
        assert tampered_check["valid"] is False
        assert len(tampered_check["broken_links"]) > 0


# ==============================================================================
# 5. InvestigationAuditService Tests
# ==============================================================================

class TestInvestigationAuditService:
    @pytest.mark.asyncio
    async def test_audit_trail_logging_and_verification(self, session: AsyncSession, police_user: User):
        repo = BlockchainRepository(session)
        bc_service = BlockchainService(repo)
        audit_service = InvestigationAuditService(repo, bc_service)

        case_id = uuid.uuid4()

        # Action 1: FIR Processed
        a1 = await audit_service.log_event(
            case_id=case_id,
            entity_type=EntityType.CASE.value,
            entity_id=str(case_id),
            action=InvestigationAuditAction.CASE_CREATED.value,
            description="Case opened by Investigating Officer",
            actor_id=police_user.id,
            actor_role=police_user.role.value,
        )
        assert a1.previous_hash is None
        assert len(a1.data_hash) == 64

        # Action 2: Evidence uploaded
        a2 = await audit_service.log_event(
            case_id=case_id,
            entity_type=EntityType.EVIDENCE.value,
            entity_id="ev-999",
            action=InvestigationAuditAction.EVIDENCE_UPLOADED.value,
            description="Physical weapon evidence logged into chain",
            actor_id=police_user.id,
            actor_role=police_user.role.value,
        )
        assert a2.previous_hash == a1.data_hash

        trail = await audit_service.get_case_audit_trail(case_id)
        assert len(trail) == 2

        chain_valid = await audit_service.verify_audit_chain(case_id)
        assert chain_valid["valid"] is True


# ==============================================================================
# 6. IntegrityService Integration Tests
# ==============================================================================

class TestIntegrityService:
    @pytest.mark.asyncio
    async def test_register_and_verify_evidence_lifecycle(
        self, session: AsyncSession, police_user: User
    ):
        # Create a test case and evidence
        case = Case(
            case_number="CASE-DEL-2026-TEST",
            title="Commercial Warehouse Burglary",
            description="Burglary reported at Sector 62 warehouse",
            crime_category=CrimeCategory.ROBBERY.value,
            priority=CasePriority.HIGH,
            status=CaseStatus.UNDER_INVESTIGATION,
            created_by_id=police_user.id,
            lead_investigator_id=police_user.id,
        )
        session.add(case)
        await session.commit()
        await session.refresh(case)

        file_content = b"Digital Forensic Disc Image - 100MB Raw Hash Data"
        original_file_hash = EvidenceHashService.hash_bytes(file_content)

        evidence = Evidence(
            case_id=case.id,
            title="Server Hard Disk Image",
            description="Forensic bit-stream clone of server disk",
            evidence_type=EvidenceType.DOCUMENT,
            file_name="disk_image.raw",
            file_url="http://storage.local/disk_image.raw",
            file_hash=original_file_hash,
            uploaded_by_id=police_user.id,
        )
        session.add(evidence)
        await session.commit()
        await session.refresh(evidence)

        repo = BlockchainRepository(session)
        bc_service = BlockchainService(repo)
        custody_service = ChainOfCustodyService(repo, bc_service)
        audit_service = InvestigationAuditService(repo, bc_service)
        integrity_service = IntegrityService(repo, bc_service, custody_service, audit_service)

        # 1. Register integrity
        integrity_rec = await integrity_service.register_evidence(evidence, police_user)
        assert integrity_rec is not None
        assert len(integrity_rec.original_hash) == 64
        assert integrity_rec.verification_status == IntegrityStatus.REGISTERED.value

        # 2. Verify intact evidence
        verification = await integrity_service.verify_evidence(evidence, police_user)
        assert verification["status"] == IntegrityStatus.VERIFIED.value

        # 3. Simulate evidence tampering (e.g. file hash modified)
        evidence.file_hash = EvidenceHashService.hash_bytes(b"Tampered payload")
        tampered_result = await integrity_service.verify_evidence(evidence, police_user)
        assert tampered_result["status"] == IntegrityStatus.TAMPERED.value

        # 4. Summary of case integrity
        case_summary = await integrity_service.get_case_integrity(case.id)
        assert case_summary["total_integrity_records"] >= 1
        assert case_summary["tampered"] >= 1
        assert case_summary["overall_status"] == "TAMPERED"


# ==============================================================================
# 7. Blockchain API Endpoints & RBAC Tests
# ==============================================================================

class TestBlockchainAPI:
    @pytest.mark.asyncio
    async def test_health_endpoint_authenticated(self, police_client: AsyncClient):
        response = await police_client.get("/api/v1/blockchain/health")
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["success"] is True
        assert json_data["data"]["status"] == "healthy"
        assert json_data["data"]["provider"] == "mock"

    @pytest.mark.asyncio
    async def test_unauthenticated_request_rejected(self, client: AsyncClient):
        response = await client.get("/api/v1/blockchain/health")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_citizen_forbidden_from_police_endpoints(
        self, citizen_client: AsyncClient
    ):
        random_id = str(uuid.uuid4())
        response = await citizen_client.get(f"/api/v1/cases/{random_id}/integrity")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_case_integrity_api_lifecycle(
        self, police_client: AsyncClient, session: AsyncSession, police_user: User
    ):
        # Create a test case
        case = Case(
            case_number="CASE-DEL-2026-API-TEST",
            title="Cyber Extortion Ring",
            description="API integration verification case",
            crime_category=CrimeCategory.CYBERCRIME.value,
            priority=CasePriority.CRITICAL,
            status=CaseStatus.ACTIVE,
            created_by_id=police_user.id,
            lead_investigator_id=police_user.id,
        )
        session.add(case)
        await session.commit()
        await session.refresh(case)

        # Query integrity
        response = await police_client.get(f"/api/v1/cases/{case.id}/integrity")
        assert response.status_code == 200
        res_data = response.json()
        assert res_data["success"] is True
        assert res_data["data"]["case_id"] == str(case.id)

        # Query audit trail
        audit_resp = await police_client.get(f"/api/v1/cases/{case.id}/audit")
        assert audit_resp.status_code == 200
        assert audit_resp.json()["success"] is True
