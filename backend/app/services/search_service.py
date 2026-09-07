"""Multi-entity intelligence search service with query normalization and Valkey caching."""

from typing import Any, Dict, List, Optional
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_ml.models.ai_models import Entity
from app.core.constants import UserRole
from app.models.user import User
from app.repositories.case_repository import CaseRepository
from app.repositories.fir_repository import FIRRepository
from app.schemas.case import CaseResponse
from app.schemas.fir import FIRResponse
from app.schemas.search import SearchResultsResponse


class SearchService:
    """Service performing unified, fast-access search across FIRs, Cases, and multi-source Entities."""

    def __init__(
        self,
        fir_repo: FIRRepository,
        case_repo: CaseRepository,
        session: Optional[AsyncSession] = None,
        cache_service: Optional[Any] = None,
    ):
        self.fir_repo = fir_repo
        self.case_repo = case_repo
        self.session = session
        from app.services.cache_service import cache_service as default_cache
        self.cache = cache_service or default_cache

    async def search(self, query: str, current_user: User, limit: int = 20) -> SearchResultsResponse:
        """Search across FIRs, Cases, and Entities respecting role boundaries with caching."""
        normalized_query = self.cache.keys.normalize_search_query(query)
        if not normalized_query:
            return SearchResultsResponse(
                firs=[],
                cases=[],
                people=[],
                vehicles=[],
                phones=[],
                locations=[],
                organizations=[],
                evidence=[],
                results={
                    "cases": [],
                    "firs": [],
                    "people": [],
                    "vehicles": [],
                    "phones": [],
                    "locations": [],
                    "organizations": [],
                    "evidence": [],
                },
                total_matches=0,
                query=query.strip(),
            )

        # 1. Check Valkey cache with normalized key
        cache_key = self.cache.keys.search(
            query=normalized_query,
            role=current_user.role.value,
            limit=limit,
        )
        cached = await self.cache.get(cache_key)
        if cached is not None and isinstance(cached, dict):
            try:
                return SearchResultsResponse.model_validate(cached)
            except Exception:
                pass

        # 2. Fetch matching FIRs
        raw_firs = await self.fir_repo.search(query=normalized_query, offset=0, limit=limit)
        if current_user.role == UserRole.CITIZEN:
            matching_firs = [f for f in raw_firs if f.submitted_by_id == current_user.id]
        else:
            matching_firs = list(raw_firs)

        # 3. Fetch matching Cases (Citizens cannot search general Cases)
        matching_cases = []
        if current_user.role in (UserRole.POLICE, UserRole.ADMIN):
            raw_cases = await self.case_repo.search(query=normalized_query, offset=0, limit=limit)
            matching_cases = list(raw_cases)

        fir_responses = [FIRResponse.model_validate(f) for f in matching_firs]
        case_responses = [CaseResponse.model_validate(c) for c in matching_cases]

        # 4. Multi-Category Entity Search (for Law Enforcement / Admin)
        people: List[Dict[str, Any]] = []
        vehicles: List[Dict[str, Any]] = []
        phones: List[Dict[str, Any]] = []
        locations: List[Dict[str, Any]] = []
        organizations: List[Dict[str, Any]] = []

        if self.session is not None and current_user.role in (UserRole.POLICE, UserRole.ADMIN):
            try:
                ent_stmt = (
                    select(Entity)
                    .where(
                        or_(
                            Entity.name.ilike(f"%{normalized_query}%"),
                            Entity.normalized_value.ilike(f"%{normalized_query}%"),
                        )
                    )
                    .limit(limit)
                )
                ent_res = await self.session.execute(ent_stmt)
                entities = list(ent_res.scalars().all())

                for ent in entities:
                    ent_dict = {
                        "id": str(ent.id),
                        "name": ent.name,
                        "type": ent.entity_type,
                        "confidence": ent.confidence,
                        "case_id": str(ent.case_id) if ent.case_id else None,
                    }
                    etype = (ent.entity_type or "").upper()
                    if etype in ("PERSON", "SUSPECT", "CRIMINAL"):
                        people.append(ent_dict)
                    elif etype in ("VEHICLE", "CAR", "BIKE", "PLATE"):
                        vehicles.append(ent_dict)
                    elif etype in ("PHONE", "MOBILE", "NUMBER"):
                        phones.append(ent_dict)
                    elif etype in ("LOCATION", "ADDRESS", "CITY", "SCENE"):
                        locations.append(ent_dict)
                    elif etype in ("ORGANIZATION", "GANG", "SYNDICATE", "BANK"):
                        organizations.append(ent_dict)
            except Exception:
                pass

        results_categorized = {
            "cases": [c.model_dump(mode="json") for c in case_responses],
            "firs": [f.model_dump(mode="json") for f in fir_responses],
            "people": people,
            "vehicles": vehicles,
            "phones": phones,
            "locations": locations,
            "organizations": organizations,
            "evidence": [],
        }

        total_count = (
            len(fir_responses)
            + len(case_responses)
            + len(people)
            + len(vehicles)
            + len(phones)
            + len(locations)
            + len(organizations)
        )

        response = SearchResultsResponse(
            firs=fir_responses,
            cases=case_responses,
            people=people,
            vehicles=vehicles,
            phones=phones,
            locations=locations,
            organizations=organizations,
            evidence=[],
            results=results_categorized,
            total_matches=total_count,
            query=query.strip(),
        )

        # 5. Store in Valkey cache
        await self.cache.set(
            cache_key,
            response.model_dump(mode="json"),
            ttl=self.cache.ttl.SEARCH,
        )

        return response
