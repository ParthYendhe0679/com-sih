"""Case repository implementation."""

from typing import Dict, List, Optional, Sequence
import uuid
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import CasePriority, CaseStatus
from app.models.case import Case
from app.models.case_note import CaseNote
from app.repositories.base_repository import BaseRepository


class CaseRepository(BaseRepository[Case]):
    """Data access repository for Case entities and investigation notes."""

    def __init__(self, session: AsyncSession):
        super().__init__(Case, session)

    async def get_by_case_number(self, case_number: str) -> Optional[Case]:
        """Lookup Case by unique identifier string."""
        stmt = select(Case).where(Case.case_number == case_number.strip())
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_for_investigator(
        self,
        investigator_id: uuid.UUID,
        status: Optional[CaseStatus] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Case]:
        """List cases assigned to a specific lead investigator."""
        stmt = select(Case).where(Case.lead_investigator_id == investigator_id)
        if status is not None:
            stmt = stmt.where(Case.status == status)
        stmt = stmt.order_by(Case.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_for_investigator(
        self,
        investigator_id: uuid.UUID,
        status: Optional[CaseStatus] = None,
    ) -> int:
        """Count cases assigned to a specific lead investigator."""
        stmt = select(func.count()).select_from(Case).where(Case.lead_investigator_id == investigator_id)
        if status is not None:
            stmt = stmt.where(Case.status == status)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def list_cases(
        self,
        status: Optional[CaseStatus] = None,
        priority: Optional[CasePriority] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Case]:
        """List all cases with optional status and priority filters."""
        stmt = select(Case)
        if status is not None:
            stmt = stmt.where(Case.status == status)
        if priority is not None:
            stmt = stmt.where(Case.priority == priority)
        stmt = stmt.order_by(Case.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_cases(
        self,
        status: Optional[CaseStatus] = None,
        priority: Optional[CasePriority] = None,
    ) -> int:
        """Count total cases with optional filters."""
        stmt = select(func.count()).select_from(Case)
        if status is not None:
            stmt = stmt.where(Case.status == status)
        if priority is not None:
            stmt = stmt.where(Case.priority == priority)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def search(
        self,
        query: str,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Case]:
        """Search Cases across case_number, title, crime_category, or description."""
        pattern = f"%{query.strip()}%"
        stmt = select(Case).where(
            or_(
                Case.case_number.ilike(pattern),
                Case.title.ilike(pattern),
                Case.crime_category.ilike(pattern),
                Case.description.ilike(pattern),
            )
        ).order_by(Case.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_status(self, status: CaseStatus) -> int:
        """Count cases by status."""
        stmt = select(func.count()).select_from(Case).where(Case.status == status)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_status_distribution(self) -> Dict[str, int]:
        """Aggregate counts across all Case statuses."""
        stmt = select(Case.status, func.count()).group_by(Case.status)
        result = await self.session.execute(stmt)
        counts = {row[0].value if hasattr(row[0], "value") else str(row[0]): row[1] for row in result.all()}
        for s in CaseStatus:
            if s.value not in counts:
                counts[s.value] = 0
        return counts

    async def add_note(self, case_id: uuid.UUID, author_id: uuid.UUID, note_text: str) -> CaseNote:
        """Append an investigative note to a Case."""
        note = CaseNote(case_id=case_id, author_id=author_id, note=note_text)
        self.session.add(note)
        await self.session.flush()
        await self.session.refresh(note)
        return note

    async def get_notes_for_case(self, case_id: uuid.UUID) -> Sequence[CaseNote]:
        """Fetch all notes associated with a Case ordered chronologically descending."""
        stmt = select(CaseNote).where(CaseNote.case_id == case_id).order_by(CaseNote.created_at.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()
