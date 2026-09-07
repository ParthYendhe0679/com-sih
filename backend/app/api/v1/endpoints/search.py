"""Search endpoints across FIR and Case entities."""

from fastapi import APIRouter, Depends, Query
from app.api.deps import get_current_user, get_search_service
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.search import SearchResultsResponse
from app.services.search_service import SearchService
from app.utils.response import success_response

router = APIRouter()


@router.get(
    "",
    response_model=APIResponse[SearchResultsResponse],
    summary="Multi-Entity Search",
    description="Search across FIR numbers, Case numbers, Titles, and Crime categories.",
)
async def search(
    q: str = Query(..., min_length=1, description="Search term or identifier"),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    search_service: SearchService = Depends(get_search_service),
):
    results = await search_service.search(query=q, current_user=current_user, limit=limit)
    return success_response(data=results, message="Search results retrieved.")
