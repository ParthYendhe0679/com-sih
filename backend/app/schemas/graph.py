"""Pydantic DTOs and API Schemas for KRITAGAS Neo4j Graph Intelligence."""

from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class GraphNode(BaseModel):
    """Normalized graph vertex representation compatible with Cytoscape and Neo4j."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    type: str  # Person, Phone, Vehicle, Location, Organization, Account, Case, FIR, Evidence
    data: Dict[str, Any] = Field(default_factory=dict)
    confidence: Optional[float] = 1.0
    source: Optional[str] = None


class GraphEdge(BaseModel):
    """Normalized directed graph edge connecting two entities with investigative evidence basis."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    target: str
    relationship: str
    confidence: float = 1.0
    evidence_basis: List[str] = Field(default_factory=list)
    case_ids: List[str] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)


class GraphStatistics(BaseModel):
    """Quantitative network topology metrics."""
    node_count: int = 0
    edge_count: int = 0
    node_types: Dict[str, int] = Field(default_factory=dict)
    relationship_types: Dict[str, int] = Field(default_factory=dict)
    density: float = 0.0


class CaseGraphResponse(BaseModel):
    """Comprehensive graph response for an investigation case."""
    case_id: str
    case_number: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    statistics: GraphStatistics
    engine: str = "neo4j"  # "neo4j" | "postgres_synthesis"


class CaseNetworkResponse(BaseModel):
    """Direct Cytoscape-compatible network visualization payload for frontend."""
    case_id: str
    case_number: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    total_nodes: int
    total_edges: int
    engine: str = "neo4j"


class HiddenConnectionItem(BaseModel):
    """Discovered latent link or multi-hop path connecting non-obvious entities."""
    connection_type: str  # COMMON_ASSOCIATE | MULTI_HOP | SHARED_RESOURCE | CROSS_CASE
    source_entity: Dict[str, Any]
    target_entity: Dict[str, Any]
    intermediaries: List[Dict[str, Any]] = Field(default_factory=list)
    hop_distance: int = 1
    confidence: float = 0.8
    evidence_basis: List[str] = Field(default_factory=list)
    description: str


class SharedResourceItem(BaseModel):
    """Resource (phone, bank account, vehicle, location) co-utilized by multiple persons."""
    resource_id: str
    resource_type: str  # PHONE, BANK_ACCOUNT, VEHICLE, LOCATION
    resource_value: str
    connected_persons: List[Dict[str, Any]] = Field(default_factory=list)
    case_ids: List[str] = Field(default_factory=list)


class ShortestPathResponse(BaseModel):
    """Shortest investigative connection path between two target entities."""
    source_id: str
    target_id: str
    path_length: int
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    evidence_chain: List[str] = Field(default_factory=list)


class CrossCaseEntityItem(BaseModel):
    """Entity appearing across multiple independent investigation cases."""
    entity_id: str
    name: str
    entity_type: str
    cases: List[Dict[str, Any]] = Field(default_factory=list)
    total_cases: int = 0


class GraphAnalyticsResponse(BaseModel):
    """Graph-theoretic intelligence metrics including centrality, clusters, and bridges."""
    case_id: str
    high_connectivity_entities: List[Dict[str, Any]] = Field(default_factory=list)
    central_intermediaries: List[Dict[str, Any]] = Field(default_factory=list)
    clusters: List[Dict[str, Any]] = Field(default_factory=list)
    degree_centrality: Dict[str, float] = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class GraphSyncRequest(BaseModel):
    """Request payload for manual or automated case graph synchronization."""
    include_evidence: bool = True
    include_firs: bool = True
    force_rebuild: bool = False


class GraphSyncResponse(BaseModel):
    """Results of PostgreSQL to Neo4j graph synchronization."""
    case_id: str
    nodes_synced: int
    edges_synced: int
    status: str
    message: str
    duration_ms: float
