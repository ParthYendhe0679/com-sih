"""KRITAGAS Part 5 Centralized Data Synchronization Service.

Synchronizes the complete intelligence lifecycle across:
Cases -> FIRs -> Evidence/DataSources -> OCR/NLP -> Entities ->
Entity Resolution -> Case Entity Contexts -> Entity Relationships ->
AI / SAMANVAYA Agents -> Investigation Reports -> Blockchain Integrity -> Audit Logs.
"""

import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_ml.models.ai_models import (
    Entity,
    EntityMatch,
)
from app.ai_ml.relationship_discovery.relationship_engine import RelationshipDiscoveryEngine
from app.ai_ml.samanvaya.agent_interfaces import samanvaya_orchestrator
from app.blockchain.constants import (
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
from app.blockchain.repository import BlockchainRepository
from app.blockchain.services.hash_service import EvidenceHashService
from app.core.constants import (
    AuditAction,
    EvidenceStatus,
    EvidenceType,
    UserRole,
)
from app.core.exceptions import (
    BadRequestException,
    NotFoundException,
    PermissionDeniedException,
)
from app.core.logging import get_logger
from app.models.audit_log import AuditLog
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

logger = get_logger("kritagas.data_synchronization_service")


class DataSynchronizationService:
    """Central orchestrator for database-wide synchronization across KRITAGAS intelligence layers."""

    def __init__(self, session: AsyncSession, cache_service: Optional[Any] = None):
        self.session = session
        self.hash_service = EvidenceHashService
        self.blockchain_repo = BlockchainRepository(session)
        self.rel_engine = RelationshipDiscoveryEngine()
        from app.services.cache_service import cache_service as default_cache
        self.cache = cache_service or default_cache

    async def _invalidate_case_cache(self, case_id: uuid.UUID):
        """Targeted eviction of case-scoped and dashboard caches."""
        try:
            await self.cache.delete_pattern(self.cache.keys.case_pattern(case_id))
            await self.cache.delete_pattern(self.cache.keys.graph_pattern(case_id))
            await self.cache.delete_pattern(self.cache.keys.dashboard_pattern())
        except Exception:
            pass

    # -------------------------------------------------------------
    # 1. Multi-Source Ingestion & Evidence Integrity Registration
    # -------------------------------------------------------------

    async def ingest_document_source(
        self,
        case_id: uuid.UUID,
        source_type: str,
        source_reference: str,
        title: str,
        file_name: str,
        file_url: str,
        uploaded_by: User,
        fir_id: Optional[uuid.UUID] = None,
        source_system: Optional[str] = None,
        raw_metadata: Optional[Dict[str, Any]] = None,
        file_content: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        """Ingest an external intelligence data source (FIR, CDR, Financial, CCTV, etc.)
        and atomically register its Evidence, DataSource, Blockchain integrity record,
        and Audit event.
        """
        stmt = select(Case).where(Case.id == case_id)
        res = await self.session.execute(stmt)
        case = res.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        # Compute or synthesize SHA-256 hash
        if file_content:
            file_hash = EvidenceHashService.hash_bytes(file_content)
            file_size = len(file_content)
        else:
            pseudo_content = f"{case_id}:{source_reference}:{title}:{datetime.now(timezone.utc).isoformat()}"
            file_hash = EvidenceHashService.hash_text(pseudo_content)
            file_size = len(pseudo_content)


        # 1. Create Evidence record
        evidence = Evidence(
            id=uuid.uuid4(),
            case_id=case.id,
            fir_id=fir_id,
            title=title,
            description=f"Source {source_type} ingested from {source_system or 'MANUAL'}",
            evidence_type=EvidenceType.DOCUMENT,
            file_name=file_name,
            file_url=file_url,
            file_hash=file_hash,
            file_size=file_size,
            uploaded_by_id=uploaded_by.id,
            status=EvidenceStatus.COLLECTED,
            metadata_json=raw_metadata,
        )
        self.session.add(evidence)

        # 2. Create DataSource record
        data_source = DataSource(
            id=uuid.uuid4(),
            source_type=source_type.upper(),
            case_id=case.id,
            fir_id=fir_id,
            evidence_id=evidence.id,
            source_reference=source_reference,
            source_system=source_system or "KRITAGAS_GATEWAY",
            uploaded_by_id=uploaded_by.id,
            processing_status="PROCESSING",
            raw_metadata=raw_metadata,
        )
        self.session.add(data_source)

        # 3. Register Blockchain Evidence Integrity
        block_num = await self.blockchain_repo.get_latest_block_number() + 1
        prev_hash = await self.blockchain_repo.get_latest_block_hash()
        bc_record = BlockchainRecord(
            id=uuid.uuid4(),
            record_type=RecordType.EVIDENCE_HASH.value,
            entity_type=EntityType.EVIDENCE.value,
            entity_id=str(evidence.id),
            case_id=case.id,
            data_hash=file_hash,
            previous_hash=prev_hash,
            block_number=block_num,
            transaction_id=f"TX-EV-{uuid.uuid4().hex[:16]}",
            provider="mock",
            status=BlockchainRecordStatus.REGISTERED.value,
            metadata_json={
                "file_name": file_name,
                "source_type": source_type,
                "uploader": uploaded_by.username,
            },
        )
        blockchain_record = await self.blockchain_repo.create_blockchain_record(bc_record)

        integrity = EvidenceIntegrityRecord(
            id=uuid.uuid4(),
            evidence_id=evidence.id,
            case_id=case.id,
            entity_type=EntityType.EVIDENCE.value,
            entity_id=str(evidence.id),
            original_hash=file_hash,
            verification_status=IntegrityStatus.REGISTERED.value,
            blockchain_record_id=blockchain_record.id,
            verified_by_id=uploaded_by.id,
        )
        integrity_record = await self.blockchain_repo.create_integrity_record(integrity)

        # 4. Chain of Custody Initial Collection Event
        custody = ChainOfCustodyEvent(
            id=uuid.uuid4(),
            evidence_id=evidence.id,
            case_id=case.id,
            entity_id=str(evidence.id),
            event_type=CustodyEventType.EVIDENCE_UPLOADED.value,
            description=f"Source evidence '{title}' ingested by {uploaded_by.username}",
            performed_by_id=uploaded_by.id,
            event_hash=file_hash,
            blockchain_record_id=blockchain_record.id,
        )
        custody_event = await self.blockchain_repo.create_custody_event(custody)



        # 5. Audit Log
        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=uploaded_by.id,
            action=AuditAction.EVIDENCE_ADDED.value,
            resource_type="data_source",
            resource_id=str(data_source.id),
            description=f"Ingested {source_type} data source '{title}' with SHA-256 {file_hash[:12]}...",
        )
        self.session.add(audit)

        await self.session.commit()
        await self.session.refresh(data_source)
        await self.session.refresh(evidence)

        await self._invalidate_case_cache(case.id)

        logger.info(
            f"Successfully ingested data source {data_source.id} for case {case.case_number} with hash {file_hash[:16]}"
        )

        return {
            "data_source_id": str(data_source.id),
            "evidence_id": str(evidence.id),
            "case_id": str(case.id),
            "source_type": data_source.source_type,
            "file_hash": file_hash,
            "blockchain_tx": blockchain_record.transaction_id,
            "status": "INGESTED",
        }

    # -------------------------------------------------------------
    # 2. OCR / NLP Entity Extraction & Case Context Synchronization
    # -------------------------------------------------------------

    async def process_text_entities(
        self,
        case_id: uuid.UUID,
        text: str,
        user: User,
        fir_id: Optional[uuid.UUID] = None,
        source_evidence_id: Optional[uuid.UUID] = None,
        extraction_method: str = "NLP_EXTRACTION",
    ) -> List[Dict[str, Any]]:
        """Extract entities from narrative text (OCR text or FIR narrative),
        normalize them, link to canonical global Entity records, and create
        case-specific CaseEntityContext rows.
        """
        stmt = select(Case).where(Case.id == case_id)
        res = await self.session.execute(stmt)
        case = res.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        extracted_raw: List[Dict[str, Any]] = []

        # 1. Regex Entity Matching Rules
        # Phones (Indian standard 10-digit)
        phone_matches = re.findall(r"(?:\+?91|0)?[6-9]\d{9}", text)
        for p in set(phone_matches):
            clean_phone = p[-10:]
            extracted_raw.append({
                "entity_type": "PHONE",
                "name": f"+91-{clean_phone}",
                "normalized_value": clean_phone,
                "confidence": 0.95,
                "role": "SUSPECT" if "suspect" in text.lower() else "PERSON_OF_INTEREST",
                "original_text": p,
            })

        # Vehicles (Indian RTO standard registration)
        vehicle_matches = re.findall(r"[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}", text.replace(" ", ""))
        for v in set(vehicle_matches):
            extracted_raw.append({
                "entity_type": "VEHICLE",
                "name": v,
                "normalized_value": v.upper(),
                "confidence": 0.92,
                "role": "INSTRUMENTALITY",
                "original_text": v,
            })

        # Bank Accounts (9-18 digit numbers preceded by A/c or Account)
        account_matches = re.findall(r"(?:A/c|Account|Acc\.?)\s*(?:No\.?)?\s*([0-9]{9,18})", text, re.IGNORECASE)
        for a in set(account_matches):
            extracted_raw.append({
                "entity_type": "BANK_ACCOUNT",
                "name": f"Account {a}",
                "normalized_value": a,
                "confidence": 0.90,
                "role": "FINANCIAL_NODE",
                "original_text": a,
            })

        # Locations (Preceded by at / near / in / location / sector)
        location_matches = re.findall(
            r"(?:at|near|in|sector|road)\s+([A-Z][a-zA-Z0-9\s]{2,25}(?:Nagar|Colony|Highway|Chowk|Marg|Sector\s*\d+|Street)?)",
            text,
        )
        for loc in set(location_matches):
            clean_loc = loc.strip()
            if len(clean_loc) >= 4 and not clean_loc.lower().startswith("the"):
                extracted_raw.append({
                    "entity_type": "LOCATION",
                    "name": clean_loc,
                    "normalized_value": clean_loc.upper(),
                    "confidence": 0.85,
                    "role": "CRIME_SCENE",
                    "original_text": clean_loc,
                })

        # Persons (Named entities identified by salutations or title markers)
        person_matches = re.findall(
            r"(?:Mr\.?|Ms\.?|Mrs\.?|Shri|Dr\.?|Suspect|Accused|Witness)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
            text,
        )
        for per in set(person_matches):
            clean_name = per.strip()
            extracted_raw.append({
                "entity_type": "PERSON",
                "name": clean_name,
                "normalized_value": clean_name.lower().replace(" ", "_"),
                "confidence": 0.88,
                "role": "SUSPECT" if "suspect" in text.lower() or "accused" in text.lower() else "WITNESS",
                "original_text": clean_name,
            })

        # Fallback person if narrative clearly names the primary subject
        if not any(e["entity_type"] == "PERSON" for e in extracted_raw) and case.title:
            extracted_raw.append({
                "entity_type": "PERSON",
                "name": case.title.split("-")[-1].strip() or "Subject Person",
                "normalized_value": (case.title.split("-")[-1].strip() or "subject_person").lower().replace(" ", "_"),
                "confidence": 0.75,
                "role": "PERSON_OF_INTEREST",
                "original_text": case.title,
            })

        results = []

        # 2. Persist or Link to Canonical Global Entity + Case Context
        for item in extracted_raw:
            ent_type = item["entity_type"]
            norm_val = item["normalized_value"]

            # Query if global entity exists
            stmt = select(Entity).where(
                and_(Entity.entity_type == ent_type, Entity.normalized_value == norm_val)
            )
            res = await self.session.execute(stmt)
            canonical_entity = res.scalar_one_or_none()

            if not canonical_entity:
                # Create global entity
                canonical_entity = Entity(
                    id=uuid.uuid4(),
                    case_id=case.id,  # Initial observed case
                    fir_id=fir_id,
                    entity_type=ent_type,
                    name=item["name"],
                    normalized_value=norm_val,
                    confidence=item["confidence"],
                    source_text=item.get("original_text"),
                    is_canonical=True,
                )
                self.session.add(canonical_entity)
                await self.session.flush()

            # Check if CaseEntityContext already exists for this case + entity + role
            ctx_stmt = select(CaseEntityContext).where(
                and_(
                    CaseEntityContext.case_id == case.id,
                    CaseEntityContext.entity_id == canonical_entity.id,
                    CaseEntityContext.role == item["role"],
                )
            )
            ctx_res = await self.session.execute(ctx_stmt)
            existing_ctx = ctx_res.scalar_one_or_none()

            if not existing_ctx:
                case_ctx = CaseEntityContext(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    entity_id=canonical_entity.id,
                    role=item["role"],
                    fir_id=fir_id,
                    source_evidence_id=source_evidence_id,
                    confidence=item["confidence"],
                    extraction_method=extraction_method,
                    original_text=item.get("original_text"),
                    status="CONFIRMED" if item["confidence"] >= 0.90 else "EXTRACTED",
                )
                self.session.add(case_ctx)
                await self.session.flush()
                ctx_id = str(case_ctx.id)
            else:
                ctx_id = str(existing_ctx.id)

            results.append({
                "entity_id": str(canonical_entity.id),
                "context_id": ctx_id,
                "name": canonical_entity.name,
                "type": canonical_entity.entity_type,
                "role": item["role"],
                "normalized": canonical_entity.normalized_value,
                "confidence": item["confidence"],
            })

        await self.session.commit()
        await self._invalidate_case_cache(case.id)

        logger.info(
            f"Extracted and synchronized {len(results)} entities into case {case.case_number}."
        )
        return results

    # -------------------------------------------------------------
    # 3. Entity Relationships Discovery & Database Persistence
    # -------------------------------------------------------------

    async def discover_and_persist_relationships(
        self,
        case_id: uuid.UUID,
        user: User,
    ) -> List[Dict[str, Any]]:
        """Discover directional, evidence-backed connections between entities
        in a case and persist them to the entity_relationships table.
        """
        stmt = select(Case).where(Case.id == case_id)
        res = await self.session.execute(stmt)
        case = res.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        # Load all entities participating in this case
        ctx_stmt = select(CaseEntityContext).where(CaseEntityContext.case_id == case.id)
        ctx_res = await self.session.execute(ctx_stmt)
        contexts = list(ctx_res.scalars().all())

        if not contexts:
            # Fallback: check legacy Entity.case_id
            leg_stmt = select(Entity).where(Entity.case_id == case.id)
            leg_res = await self.session.execute(leg_stmt)
            entities = list(leg_res.scalars().all())
        else:
            entity_ids = [c.entity_id for c in contexts]
            e_stmt = select(Entity).where(Entity.id.in_(entity_ids))
            e_res = await self.session.execute(e_stmt)
            entities = list(e_res.scalars().all())

        if not entities:
            logger.warning(f"No entities available to discover relationships for case {case_id}")
            return []

        # Run discovery engine
        discovered_raw = self.rel_engine.discover_case_relationships(case, entities)
        persisted_records = []

        for rel in discovered_raw:
            # Skip case target nodes
            if rel.get("target_type") == "CASE":
                continue

            try:
                src_uuid = uuid.UUID(rel["source"])
                tgt_uuid = uuid.UUID(rel["target"])
            except (ValueError, TypeError):
                continue

            rel_type = rel.get("relationship", "ASSOCIATED_WITH")

            # Check if relationship already exists
            exist_stmt = select(EntityRelationship).where(
                and_(
                    EntityRelationship.case_id == case.id,
                    EntityRelationship.source_entity_id == src_uuid,
                    EntityRelationship.target_entity_id == tgt_uuid,
                    EntityRelationship.relationship_type == rel_type,
                )
            )
            exist_res = await self.session.execute(exist_stmt)
            existing_rel = exist_res.scalar_one_or_none()

            if not existing_rel:
                new_rel = EntityRelationship(
                    id=uuid.uuid4(),
                    source_entity_id=src_uuid,
                    target_entity_id=tgt_uuid,
                    relationship_type=rel_type,
                    case_id=case.id,
                    confidence=rel.get("confidence", 0.85),
                    extraction_method="AI_RELATIONSHIP_ENGINE",
                    created_by_id=user.id,
                    status="CONFIRMED" if rel.get("confidence", 0) >= 0.90 else "DETECTED",
                    evidence_chain={
                        "evidence_basis": rel.get("evidence_basis", []),
                        "source_records": rel.get("source_records", []),
                    },
                )
                self.session.add(new_rel)
                await self.session.flush()
                rel_id = str(new_rel.id)
            else:
                rel_id = str(existing_rel.id)

            persisted_records.append({
                "relationship_id": rel_id,
                "source": rel.get("source_name"),
                "relationship": rel_type,
                "target": rel.get("target_name"),
                "confidence": rel.get("confidence", 0.85),
            })

        await self.session.commit()
        await self._invalidate_case_cache(case.id)

        logger.info(
            f"Discovered and persisted {len(persisted_records)} relationships for case {case.case_number}"
        )
        return persisted_records

    # -------------------------------------------------------------
    # 4. SAMANVAYA Multi-Agent Synthesis & Report Blockchain Hashing
    # -------------------------------------------------------------

    async def generate_and_persist_samanvaya_report(
        self,
        case_id: uuid.UUID,
        user: User,
    ) -> Dict[str, Any]:
        """Execute SAMANVAYA multi-agent analysis (CDR, Financial, CCTV agents),
        synthesize unified intelligence report, persist to investigation_reports,
        register immutable blockchain cryptographic hash, and record audit trail with caching.
        """
        cache_key = self.cache.keys.agent_samanvaya(case_id)
        cached = await self.cache.get(cache_key)
        if cached is not None and isinstance(cached, dict):
            return cached

        stmt = select(Case).where(Case.id == case_id)
        res = await self.session.execute(stmt)
        case = res.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        # 1. Execute SAMANVAYA Multi-Agent Orchestrator
        agent_synthesis = await samanvaya_orchestrator.run_multi_agent_investigation(
            case_id=case.case_number,
            context={
                "crime_category": case.crime_category,
                "case_title": case.title,
            },
        )

        report_title = f"SAMANVAYA Intelligence Synthesis: {case.title}"
        report_summary = agent_synthesis.get(
            "synthesized_summary",
            "Multi-agent investigation complete across telecommunications, financial, and vision streams.",
        )

        # 2. Cryptographic Content Hashing
        report_payload = {
            "case_number": case.case_number,
            "title": report_title,
            "summary": report_summary,
            "agent_reports": agent_synthesis.get("agent_reports", []),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        serialized = json.dumps(report_payload, sort_keys=True)
        content_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        # 3. Create Blockchain Record
        block_num = await self.blockchain_repo.get_latest_block_number() + 1
        prev_hash = await self.blockchain_repo.get_latest_block_hash()
        bc_record = BlockchainRecord(
            id=uuid.uuid4(),
            record_type=RecordType.AI_REPORT_HASH.value,
            entity_type=EntityType.AI_REPORT.value,
            entity_id=case.case_number,
            case_id=case.id,
            data_hash=content_hash,
            previous_hash=prev_hash,
            block_number=block_num,
            transaction_id=f"TX-RPT-{uuid.uuid4().hex[:16]}",
            provider="mock",
            status=BlockchainRecordStatus.REGISTERED.value,
            metadata_json={
                "orchestrator": "SAMANVAYA_MULTI_AGENT_V1",
                "agents": ["CDR_AGENT", "FINANCIAL_AGENT", "CCTV_AGENT"],
                "officer": user.username,
            },
        )
        blockchain_record = await self.blockchain_repo.create_blockchain_record(bc_record)


        # 4. Persist InvestigationReport
        report = InvestigationReport(
            id=uuid.uuid4(),
            case_id=case.id,
            report_type="SAMANVAYA_SYNTHESIS",
            title=report_title,
            summary=report_summary,
            content_json=report_payload,
            generated_by_id=user.id,
            agent_name="SAMANVAYA_MASTER",
            status="FINAL",
            blockchain_record_id=blockchain_record.id,
            content_hash=content_hash,
        )
        self.session.add(report)

        # 5. Record Investigation Audit Trail
        audit_rec = InvestigationAuditRecord(
            id=uuid.uuid4(),
            case_id=case.id,
            entity_type=EntityType.AI_REPORT.value,
            entity_id=str(report.id),
            action=InvestigationAuditAction.AI_REPORT_GENERATED.value,
            description=f"Generated SAMANVAYA Intelligence Report '{report_title}'",
            actor_id=user.id,
            actor_role=user.role.value if hasattr(user.role, "value") else str(user.role),
            data_hash=content_hash,
            blockchain_record_id=blockchain_record.id,
        )
        self.session.add(audit_rec)

        await self.session.commit()
        await self.session.refresh(report)

        logger.info(
            f"Successfully generated and blockchain-registered SAMANVAYA report {report.id} for case {case.case_number}"
        )

        response_data = {
            "report_id": str(report.id),
            "case_id": str(case.id),
            "case_number": case.case_number,
            "title": report.title,
            "summary": report.summary,
            "agent_reports": agent_synthesis.get("agent_reports", []),
            "content_hash": content_hash,
            "blockchain_tx": blockchain_record.transaction_id,
            "block_number": blockchain_record.block_number,
            "status": report.status,
            "created_at": report.created_at.isoformat() if report.created_at else None,
        }

        await self.cache.set(
            cache_key,
            response_data,
            ttl=self.cache.ttl.AGENT_RESULT,
        )
        return response_data

    # -------------------------------------------------------------
    # 5. Case Team Management (CaseMember)
    # -------------------------------------------------------------

    async def add_case_member(
        self,
        case_id: uuid.UUID,
        user_id: uuid.UUID,
        role: str,
        assigned_by: User,
        permissions: Optional[Dict[str, Any]] = None,
    ) -> CaseMember:
        """Assign an investigator, analyst, or forensic expert to an investigation team."""
        # Verify case exists
        stmt = select(Case).where(Case.id == case_id)
        res = await self.session.execute(stmt)
        case = res.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        # Verify assignee exists
        u_stmt = select(User).where(User.id == user_id)
        u_res = await self.session.execute(u_stmt)
        assignee = u_res.scalar_one_or_none()
        if not assignee:
            raise NotFoundException(f"User {user_id} not found.")

        # Check existing membership
        mem_stmt = select(CaseMember).where(
            and_(CaseMember.case_id == case_id, CaseMember.user_id == user_id)
        )
        mem_res = await self.session.execute(mem_stmt)
        existing_member = mem_res.scalar_one_or_none()

        if existing_member:
            existing_member.role = role
            existing_member.is_active = True
            existing_member.permissions_json = permissions
            await self.session.commit()
            await self.session.refresh(existing_member)
            return existing_member

        new_member = CaseMember(
            id=uuid.uuid4(),
            case_id=case.id,
            user_id=assignee.id,
            role=role.upper(),
            assigned_by_id=assigned_by.id,
            is_active=True,
            permissions_json=permissions,
        )
        self.session.add(new_member)

        # Audit team assignment
        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=assigned_by.id,
            action=AuditAction.CASE_ASSIGNED.value,
            resource_type="case_member",
            resource_id=str(new_member.id),
            description=f"Assigned '{assignee.username}' as {role} to Case {case.case_number}",
        )
        self.session.add(audit)

        await self.session.commit()
        await self.session.refresh(new_member)
        return new_member

    async def list_case_members(self, case_id: uuid.UUID) -> Sequence[CaseMember]:
        """List active members of a case investigation team."""
        stmt = select(CaseMember).where(
            and_(CaseMember.case_id == case_id, CaseMember.is_active == True)
        )
        res = await self.session.execute(stmt)
        return res.scalars().all()
