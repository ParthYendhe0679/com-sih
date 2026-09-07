"""Multi-entity search response schemas."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.case import CaseResponse
from app.schemas.fir import FIRResponse


class SearchResultsResponse(BaseModel):
    """Aggregated search results across FIRs, Cases, and multi-source Entities."""
    firs: List[FIRResponse] = Field(default_factory=list)
    cases: List[CaseResponse] = Field(default_factory=list)
    people: List[Dict[str, Any]] = Field(default_factory=list)
    vehicles: List[Dict[str, Any]] = Field(default_factory=list)
    phones: List[Dict[str, Any]] = Field(default_factory=list)
    locations: List[Dict[str, Any]] = Field(default_factory=list)
    organizations: List[Dict[str, Any]] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    results: Optional[Dict[str, Any]] = None
    total_matches: int = 0
    query: str

