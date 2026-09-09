"""Pydantic schemas and DTOs for KRITAGAS Geographical Case Map Intelligence."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GeoCoordinates(BaseModel):
    latitude: float
    longitude: float


class MapIntelligenceNode(BaseModel):
    """Investigation node plotted on the case map."""
    id: str
    entityId: Optional[str] = None
    type: str  # KIDNAPPING_LOCATION, CRIME_LOCATION, LAST_SEEN_LOCATION, SUSPECT_RESIDENCE, VICTIM_HOME, etc.
    label: str  # Human readable label
    name: str  # Location or entity name
    address: Optional[str] = None
    city: Optional[str] = "Mumbai"
    coordinates: GeoCoordinates
    latitude: float
    longitude: float
    importance: str = "HIGH"  # CRITICAL, HIGH, MEDIUM, LOW
    confidence: float = 0.95
    geocoded: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UnmappedLocation(BaseModel):
    """Identified case location lacking valid coordinates."""
    id: str
    name: str
    type: str = "LOCATION"
    reason: str = "Location identified but coordinates unavailable"
    importance: str = "MEDIUM"
    confidence: float = 0.85


class MapIntelligenceRelationship(BaseModel):
    """Semantic investigation edge connecting two case map vertices."""
    id: str
    source: str
    target: str
    sourceName: Optional[str] = None
    targetName: Optional[str] = None
    type: str  # LAST_SEEN_AT, LIVES_AT, OCCURRED_AT, SEEN_AT, FOUND_AT, TRANSFERRED_AT, TRAVELLED_TO, MOVED_TO
    label: str
    importance: str = "HIGH"  # CRITICAL, HIGH, NORMAL
    confidence: float = 0.95
    evidenceBasis: List[str] = Field(default_factory=list)


class MapIntelligenceStats(BaseModel):
    """Summary metrics of geographic intelligence in the case."""
    totalLocations: int = 0
    geocodedLocations: int = 0
    unmappedLocations: int = 0
    relationshipsCount: int = 0


class MapIntelligenceResponse(BaseModel):
    """Complete Case Map Intelligence payload for investigation visualization."""
    caseId: str
    caseNumber: str
    crimeCategory: str
    nodes: List[MapIntelligenceNode] = Field(default_factory=list)
    unmappedLocations: List[UnmappedLocation] = Field(default_factory=list)
    relationships: List[MapIntelligenceRelationship] = Field(default_factory=list)
    stats: MapIntelligenceStats = Field(default_factory=MapIntelligenceStats)
    source: str = "neo4j_graph"  # "neo4j_graph" | "postgres_synthesis"
    cached: bool = False
