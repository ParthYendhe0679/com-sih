"""HistoricalCaseSearchService: searches multi-decade repository for modus operandi matches."""

import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.ai_ml.models.ai_models import CaseSimilarity
from app.ai_ml.schemas.similarity import CaseSimilarityResponse, SimilarCaseItem
from app.ai_ml.similarity.case_similarity import case_similarity_engine
from app.core.exceptions import NotFoundException
from app.models.case import Case


class HistoricalCaseSearchService:
    """Searches historical case registry using multi-factor similarity matching."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.engine = case_similarity_engine

    async def search_similar_cases(
        self,
        case_id: uuid.UUID,
        years_back: Optional[int] = None,
        top_k: int = 5,
    ) -> CaseSimilarityResponse:
        """Query historical database and score similarity against current case."""
        # The similarity engine reads case.entities. That is a lazy relationship,
        # and touching it inside the synchronous scorer raised MissingGreenlet —
        # which surfaced as a 500 and an empty Past Cases screen. Load the
        # entities and the linked FIR up front so the scorer never triggers IO.
        stmt = (
            select(Case)
            .where(Case.id == case_id)
            .options(selectinload(Case.entities), selectinload(Case.fir))
        )
        result = await self.session.execute(stmt)
        source_case = result.scalar_one_or_none()
        if not source_case:
            raise NotFoundException(f"Source case {case_id} not found.")

        # Candidate selection used to be `LIMIT 50` with no ordering, so it
        # compared this case against fifty arbitrary archive rows — usually a
        # different crime in a different city. Nothing scored, and the Past
        # Cases screen came back empty. Look at cases of the same crime type
        # first, then the same city, then fall back to the rest.
        same_type = (
            select(Case)
            .where(Case.id != case_id, Case.crime_category == source_case.crime_category)
            .options(selectinload(Case.entities), selectinload(Case.fir))
            .limit(60)
        )
        candidates = list((await self.session.execute(same_type)).scalars().all())

        if len(candidates) < 40 and getattr(source_case, "city", None):
            same_city = (
                select(Case)
                .where(Case.id != case_id, Case.city == source_case.city)
                .options(selectinload(Case.entities), selectinload(Case.fir))
                .limit(40)
            )
            seen = {c.id for c in candidates}
            for c in (await self.session.execute(same_city)).scalars().all():
                if c.id not in seen:
                    candidates.append(c)
                    seen.add(c.id)

        if len(candidates) < 20:
            filler = (
                select(Case)
                .where(Case.id != case_id)
                .options(selectinload(Case.entities), selectinload(Case.fir))
                .order_by(Case.created_at.desc())
                .limit(40)
            )
            seen = {c.id for c in candidates}
            for c in (await self.session.execute(filler)).scalars().all():
                if c.id not in seen:
                    candidates.append(c)
                    seen.add(c.id)

        similarities: List[CaseSimilarity] = self.engine.find_top_similar(
            source=source_case,
            candidates=candidates,
            top_k=top_k,
        )

        cand_map = {c.id: c for c in candidates}
        matched_items: List[SimilarCaseItem] = []

        for sim in similarities:
            target = cand_map.get(sim.target_case_id)
            if not target:
                continue

            matched_items.append(
                SimilarCaseItem(
                    case_id=target.id,
                    case_number=target.case_number,
                    title=target.title,
                    crime_category=target.crime_category,
                    status=target.status.value if hasattr(target.status, "value") else str(target.status),
                    incident_date=target.created_at.strftime("%Y-%m-%d") if target.created_at else None,
                    similarity_score=sim.similarity_score,
                    semantic_score=sim.semantic_score,
                    modus_operandi_score=sim.modus_operandi_score,
                    entity_overlap_score=sim.entity_overlap_score,
                    location_score=sim.location_score,
                    temporal_score=sim.temporal_score,
                    explanation=sim.explanation_summary,
                    matched_features=list((sim.common_features or {}).keys()),
                )
            )

        from datetime import datetime, timezone
        return CaseSimilarityResponse(
            source_case_id=source_case.id,
            source_case_number=source_case.case_number,
            total_candidates_analyzed=len(candidates),
            matches=matched_items,
            generated_at=datetime.now(timezone.utc),
        )
