"""Blockchain repository — database operations for all 4 blockchain models.

Follows the existing BaseRepository pattern but specialized for blockchain tables.
"""

from typing import Optional, Sequence
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.blockchain.models import (
    BlockchainRecord,
    ChainOfCustodyEvent,
    EvidenceIntegrityRecord,
    InvestigationAuditRecord,
)
from app.core.logging import get_logger

logger = get_logger("kritagas.blockchain.repository")


class BlockchainRepository:
    """Database access for blockchain integrity tables."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ── BlockchainRecord ─────────────────────────────────────

    async def create_blockchain_record(self, record: BlockchainRecord) -> BlockchainRecord:
        self.session.add(record)
        await self.session.flush()
        await self.session.refresh(record)
        return record

    async def get_blockchain_record(self, record_id: uuid.UUID) -> Optional[BlockchainRecord]:
        stmt = select(BlockchainRecord).where(BlockchainRecord.id == record_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_transaction_id(self, transaction_id: str) -> Optional[BlockchainRecord]:
        stmt = select(BlockchainRecord).where(BlockchainRecord.transaction_id == transaction_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_latest_block_number(self) -> int:
        stmt = select(func.max(BlockchainRecord.block_number))
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_latest_block_hash(self) -> Optional[str]:
        stmt = (
            select(BlockchainRecord.data_hash)
            .order_by(BlockchainRecord.block_number.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar()

    async def count_records(self) -> int:
        stmt = select(func.count()).select_from(BlockchainRecord)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def list_records_by_case(
        self, case_id: uuid.UUID, limit: int = 50
    ) -> Sequence[BlockchainRecord]:
        stmt = (
            select(BlockchainRecord)
            .where(BlockchainRecord.case_id == case_id)
            .order_by(BlockchainRecord.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    # ── EvidenceIntegrityRecord ──────────────────────────────

    async def create_integrity_record(
        self, record: EvidenceIntegrityRecord
    ) -> EvidenceIntegrityRecord:
        self.session.add(record)
        await self.session.flush()
        await self.session.refresh(record)
        return record

    async def get_integrity_record(
        self, record_id: uuid.UUID
    ) -> Optional[EvidenceIntegrityRecord]:
        stmt = select(EvidenceIntegrityRecord).where(EvidenceIntegrityRecord.id == record_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_integrity_by_entity(
        self, entity_type: str, entity_id: str
    ) -> Optional[EvidenceIntegrityRecord]:
        stmt = (
            select(EvidenceIntegrityRecord)
            .where(
                EvidenceIntegrityRecord.entity_type == entity_type,
                EvidenceIntegrityRecord.entity_id == entity_id,
            )
            .order_by(EvidenceIntegrityRecord.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_integrity_by_evidence(
        self, evidence_id: uuid.UUID
    ) -> Optional[EvidenceIntegrityRecord]:
        stmt = (
            select(EvidenceIntegrityRecord)
            .where(EvidenceIntegrityRecord.evidence_id == evidence_id)
            .order_by(EvidenceIntegrityRecord.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_integrity_by_case(
        self, case_id: uuid.UUID, limit: int = 100
    ) -> Sequence[EvidenceIntegrityRecord]:
        stmt = (
            select(EvidenceIntegrityRecord)
            .where(EvidenceIntegrityRecord.case_id == case_id)
            .order_by(EvidenceIntegrityRecord.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update_integrity_record(
        self, record: EvidenceIntegrityRecord
    ) -> EvidenceIntegrityRecord:
        await self.session.flush()
        await self.session.refresh(record)
        return record

    # ── ChainOfCustodyEvent ──────────────────────────────────

    async def create_custody_event(self, event: ChainOfCustodyEvent) -> ChainOfCustodyEvent:
        self.session.add(event)
        await self.session.flush()
        await self.session.refresh(event)
        return event

    async def get_custody_chain(
        self, entity_id: str, limit: int = 200
    ) -> Sequence[ChainOfCustodyEvent]:
        stmt = (
            select(ChainOfCustodyEvent)
            .where(ChainOfCustodyEvent.entity_id == entity_id)
            .order_by(ChainOfCustodyEvent.timestamp.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_latest_custody_event(
        self, entity_id: str
    ) -> Optional[ChainOfCustodyEvent]:
        stmt = (
            select(ChainOfCustodyEvent)
            .where(ChainOfCustodyEvent.entity_id == entity_id)
            .order_by(ChainOfCustodyEvent.timestamp.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def count_custody_events(self, entity_id: str) -> int:
        stmt = (
            select(func.count())
            .select_from(ChainOfCustodyEvent)
            .where(ChainOfCustodyEvent.entity_id == entity_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    # ── InvestigationAuditRecord ─────────────────────────────

    async def create_audit_record(
        self, record: InvestigationAuditRecord
    ) -> InvestigationAuditRecord:
        self.session.add(record)
        await self.session.flush()
        await self.session.refresh(record)
        return record

    async def get_case_audit_trail(
        self, case_id: uuid.UUID, limit: int = 200
    ) -> Sequence[InvestigationAuditRecord]:
        stmt = (
            select(InvestigationAuditRecord)
            .where(InvestigationAuditRecord.case_id == case_id)
            .order_by(InvestigationAuditRecord.timestamp.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_latest_audit_record(
        self, case_id: uuid.UUID
    ) -> Optional[InvestigationAuditRecord]:
        stmt = (
            select(InvestigationAuditRecord)
            .where(InvestigationAuditRecord.case_id == case_id)
            .order_by(InvestigationAuditRecord.timestamp.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def count_case_audits(self, case_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(InvestigationAuditRecord)
            .where(InvestigationAuditRecord.case_id == case_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0
