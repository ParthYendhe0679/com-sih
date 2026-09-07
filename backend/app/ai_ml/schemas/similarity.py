"""Pydantic schemas for case similarity, modus operandi matching, and historical searches."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SimilarCaseItem(BaseModel):
    """Pairwise case similarity match with multi-factor breakdown and explanation."""
    case_id: uuid.UUID
    case_number: str
    title: str
    crime_category: str
    status: str
    incident_date: Optional[str] = None
    similarity_score: float = Field(ge=0.0, le=1.0)
    semantic_score: float = Field(ge=0.0, le=1.0)
    modus_operandi_score: float = Field(ge=0.0, le=1.0)
    entity_overlap_score: float = Field(ge=0.0, le=1.0)
    location_score: float = Field(ge=0.0, le=1.0)
    temporal_score: float = Field(ge=0.0, le=1.0)
    explanation: str
    matched_features: List[str] = Field(default_factory=list)


class CaseSimilarityResponse(BaseModel):
    """Search response for similar historical cases."""
    source_case_id: uuid.UUID
    source_case_number: str
    total_candidates_analyzed: int
    matches: List[SimilarCaseItem]
    generated_at: datetime
