"""FIR repository implementation."""

from typing import Dict, Optional, Sequence
import uuid
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import FIRPriority, FIRStatus
from app.models.fir import FIR
from app.repositories.base_repository import BaseRepository


class FIRRepository(BaseRepository[FIR]):
    """Data access repository for First Information Report entities."""

    def __init__(self, session: AsyncSession):
        super().__init__(FIR, session)

    async def get_by_fir_number(self, fir_number: str) -> Optional[FIR]:
        """Lookup FIR by unique tracking number."""
        stmt = select(FIR).where(FIR.fir_number == fir_number.strip())
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_for_citizen(
        self,
        citizen_id: uuid.UUID,
        status: Optional[FIRStatus] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[FIR]:
        """List FIRs submitted by a specific citizen."""
        stmt = select(FIR).where(FIR.submitted_by_id == citizen_id)
        if status is not None:
            stmt = stmt.where(FIR.status == status)
        stmt = stmt.order_by(FIR.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_for_citizen(
        self,
        citizen_id: uuid.UUID,
        status: Optional[FIRStatus] = None,
    ) -> int:
        """Count FIRs submitted by a specific citizen."""
        stmt = select(func.count()).select_from(FIR).where(FIR.submitted_by_id == citizen_id)
        if status is not None:
            stmt = stmt.where(FIR.status == status)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def list_for_police_queue(
        self,
        status: Optional[FIRStatus] = None,
        priority: Optional[FIRPriority] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[FIR]:
        """List submitted FIRs available in the police triage review queue."""
        stmt = select(FIR)
        if status is not None:
            stmt = stmt.where(FIR.status == status)
        else:
            # By default exclude DRAFT (citizens working on drafts)
            stmt = stmt.where(FIR.status != FIRStatus.DRAFT)

        if priority is not None:
            stmt = stmt.where(FIR.priority == priority)

        stmt = stmt.order_by(FIR.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_for_police_queue(
        self,
        status: Optional[FIRStatus] = None,
        priority: Optional[FIRPriority] = None,
    ) -> int:
        """Count submitted FIRs available in the police triage queue."""
        stmt = select(func.count()).select_from(FIR)
        if status is not None:
            stmt = stmt.where(FIR.status == status)
        else:
            stmt = stmt.where(FIR.status != FIRStatus.DRAFT)

        if priority is not None:
            stmt = stmt.where(FIR.priority == priority)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def search(
        self,
        query: str,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[FIR]:
        """Search FIRs across fir_number, title, crime_category, description, or location."""
        pattern = f"%{query.strip()}%"
        stmt = select(FIR).where(
            or_(
                FIR.fir_number.ilike(pattern),
                FIR.title.ilike(pattern),
                FIR.crime_category.ilike(pattern),
                FIR.incident_location.ilike(pattern),
                FIR.description.ilike(pattern),
            )
        ).order_by(FIR.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_status(self, status: FIRStatus) -> int:
        """Count FIRs by specific status."""
        stmt = select(func.count()).select_from(FIR).where(FIR.status == status)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_status_distribution(self) -> Dict[str, int]:
        """Aggregate counts across all FIR statuses."""
        stmt = select(FIR.status, func.count()).group_by(FIR.status)
        result = await self.session.execute(stmt)
        counts = {row[0].value if hasattr(row[0], "value") else str(row[0]): row[1] for row in result.all()}
        # Ensure all statuses exist in dict
        for s in FIRStatus:
            if s.value not in counts:
                counts[s.value] = 0
        return counts
