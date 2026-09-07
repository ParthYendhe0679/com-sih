"""Pydantic schemas for AI/ML case and person intelligence, graph metrics, and analysis jobs."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AnalysisJobCreate(BaseModel):
    """Payload to trigger asynchronous case analysis."""
    case_id: uuid.UUID
    run_similarity: bool = True
    run_correlation: bool = True
    run_patterns: bool = True
    run_anomalies: bool = True


class AnalysisJobResponse(BaseModel):
    """Status response for an ongoing or completed investigation analysis job."""
    id: uuid.UUID
    case_id: uuid.UUID
    status: str
    progress: int = Field(ge=0, le=100)
    current_stage: str
    result_summary: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InsightResponse(BaseModel):
    """Structured, evidence-backed intelligence lead or insight."""
    id: uuid.UUID
    case_id: uuid.UUID
    insight_type: str
    title: str
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)
    facts: List[str] = Field(default_factory=list)
    inferences: List[str] = Field(default_factory=list)
    supporting_records: List[str] = Field(default_factory=list)
    limitations: Optional[str] = None
    priority: str = "MEDIUM"
    created_at: datetime

    class Config:
        from_attributes = True


class NetworkMetricScore(BaseModel):
    """Graph intelligence centrality and community metrics."""
    node_id: str
    label: str
    entity_type: str
    degree_centrality: float
    betweenness_centrality: float
    community_id: int
    is_cross_case_bridge: bool = False


class CaseIntelligenceDossier(BaseModel):
    """Complete, consolidated intelligence package for an investigation case."""
    case_id: uuid.UUID
    case_number: str
    title: str
    investigation_priority_score: float = Field(ge=0.0, le=1.0)
    priority_breakdown: Dict[str, float]
    total_entities_extracted: int
    total_correlations_found: int
    total_similar_cases: int
    total_anomalies_flagged: int
    insights: List[InsightResponse] = Field(default_factory=list)
    graph_hubs: List[NetworkMetricScore] = Field(default_factory=list)
    generated_at: datetime


class PersonIntelligenceProfile(BaseModel):
    """360-degree aggregated intelligence profile for a target person."""
    person_id: str
    canonical_name: str
    aliases: List[str] = Field(default_factory=list)
    phone_numbers: List[str] = Field(default_factory=list)
    associated_vehicles: List[str] = Field(default_factory=list)
    known_locations: List[str] = Field(default_factory=list)
    historical_cases: List[Dict[str, Any]] = Field(default_factory=list)
    network_associations: List[Dict[str, Any]] = Field(default_factory=list)
    facts: List[str] = Field(default_factory=list)
    inferences: List[Dict[str, Any]] = Field(default_factory=list)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)
