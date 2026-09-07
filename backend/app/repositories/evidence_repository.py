"""Evidence repository implementation."""

from typing import Optional, Sequence
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.evidence import Evidence
from app.repositories.base_repository import BaseRepository


class EvidenceRepository(BaseRepository[Evidence]):
    """Data access repository for Evidence entities."""

    def __init__(self, session: AsyncSession):
        super().__init__(Evidence, session)

    async def get_by_case_id(
        self,
        case_id: uuid.UUID,
        offset: int = 0,
        limit: int = 50,
    ) -> Sequence[Evidence]:
        """List evidence linked to a specific Case."""
        stmt = (
            select(Evidence)
            .where(Evidence.case_id == case_id)
            .order_by(Evidence.uploaded_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_case_id(self, case_id: uuid.UUID) -> int:
        """Count total evidence items linked to a Case."""
        stmt = select(func.count()).select_from(Evidence).where(Evidence.case_id == case_id)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_by_fir_id(
        self,
        fir_id: uuid.UUID,
        offset: int = 0,
        limit: int = 50,
    ) -> Sequence[Evidence]:
        """List evidence linked to a specific FIR."""
        stmt = (
            select(Evidence)
            .where(Evidence.fir_id == fir_id)
            .order_by(Evidence.uploaded_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_fir_id(self, fir_id: uuid.UUID) -> int:
        """Count total evidence items attached to an FIR."""
        stmt = select(func.count()).select_from(Evidence).where(Evidence.fir_id == fir_id)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_by_hash(self, file_hash: str) -> Optional[Evidence]:
        """Check if an identical evidence file hash has already been registered."""
        stmt = select(Evidence).where(Evidence.file_hash == file_hash)
        result = await self.session.execute(stmt)
        return result.scalars().first()
