"""Multi-entity search response schemas."""

from typing import List
from pydantic import BaseModel
from app.schemas.case import CaseResponse
from app.schemas.fir import FIRResponse


class SearchResultsResponse(BaseModel):
    """Aggregated search results across FIRs and Cases."""
    firs: List[FIRResponse]
    cases: List[CaseResponse]
    total_matches: int
    query: str
