"""Multi-entity search service."""

from app.core.constants import UserRole
from app.models.user import User
from app.repositories.case_repository import CaseRepository
from app.repositories.fir_repository import FIRRepository
from app.schemas.case import CaseResponse
from app.schemas.fir import FIRResponse
from app.schemas.search import SearchResultsResponse


class SearchService:
    """Service performing unified search across FIRs and investigative Cases."""

    def __init__(self, fir_repo: FIRRepository, case_repo: CaseRepository):
        self.fir_repo = fir_repo
        self.case_repo = case_repo

    async def search(self, query: str, current_user: User, limit: int = 20) -> SearchResultsResponse:
        """Search across FIRs and Cases respecting role-based data boundaries."""
        clean_query = query.strip()
        if not clean_query:
            return SearchResultsResponse(firs=[], cases=[], total_matches=0, query=clean_query)

        # Fetch matching FIRs
        raw_firs = await self.fir_repo.search(query=clean_query, offset=0, limit=limit)
        if current_user.role == UserRole.CITIZEN:
            # Citizens can only search/view their own FIRs
            matching_firs = [f for f in raw_firs if f.submitted_by_id == current_user.id]
        else:
            matching_firs = list(raw_firs)

        # Fetch matching Cases (Citizens cannot search general Cases)
        matching_cases = []
        if current_user.role in (UserRole.POLICE, UserRole.ADMIN):
            raw_cases = await self.case_repo.search(query=clean_query, offset=0, limit=limit)
            matching_cases = list(raw_cases)

        fir_responses = [FIRResponse.model_validate(f) for f in matching_firs]
        case_responses = [CaseResponse.model_validate(c) for c in matching_cases]

        return SearchResultsResponse(
            firs=fir_responses,
            cases=case_responses,
            total_matches=len(fir_responses) + len(case_responses),
            query=clean_query,
        )
