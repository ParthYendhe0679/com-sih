"""Pydantic schemas for the SAMANVAYA 5-Agent Criminal Investigation Intelligence System."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Classification & Enums
# ---------------------------------------------------------------------------

FindingClassification = Literal["VERIFIED", "SUPPORTED", "POTENTIAL", "INSUFFICIENT DATA"]
AgentStatus = Literal["WAITING", "PROCESSING", "COMPLETED", "FAILED"]


# ---------------------------------------------------------------------------
# Individual Agent Output Schemas
# ---------------------------------------------------------------------------

class Agent1ContextOutput(BaseModel):
    """Output produced by Agent 1: Case Context & Relevance Agent."""
    caseSummary: str = Field(..., description="Normalized factual summary of the incident.")
    crimeType: str = Field(..., description="Categorized crime typology.")
    importantEntities: List[Dict[str, Any]] = Field(default_factory=list, description="Extracted key persons, vehicles, objects.")
    importantLocations: List[str] = Field(default_factory=list, description="Extracted geographical points of interest.")
    importantDates: List[str] = Field(default_factory=list, description="Key temporal markers and incident dates.")
    investigationContext: str = Field(..., description="Operational context and jurisdiction scope.")
    prioritySignals: List[str] = Field(default_factory=list, description="High-priority investigative alerts.")
    relevantRecordIds: List[str] = Field(default_factory=list, description="Valkey pre-filtered record IDs selected for deeper analysis.")


class Agent2EntityOutput(BaseModel):
    """Output produced by Agent 2: Entity & Identity Intelligence Agent."""
    resolvedEntities: List[Dict[str, Any]] = Field(default_factory=list, description="Entities resolved with canonical IDs and roles.")
    potentialMatches: List[Dict[str, Any]] = Field(default_factory=list, description="Suspect/associate candidate matches with confidence scores.")
    aliases: List[Dict[str, Any]] = Field(default_factory=list, description="Identified alias linkages and phonetic matches.")
    crossCaseEntities: List[Dict[str, Any]] = Field(default_factory=list, description="Entities appearing in prior police records or historical cases.")
    confidenceScores: Dict[str, float] = Field(default_factory=dict, description="Resolution confidence per entity.")


class Agent3NetworkOutput(BaseModel):
    """Output produced by Agent 3: Network & Relationship Agent."""
    nodes: List[Dict[str, Any]] = Field(default_factory=list, description="Graph nodes with metadata.")
    relationships: List[Dict[str, Any]] = Field(default_factory=list, description="Directed, evidence-backed edges.")
    networkClusters: List[Dict[str, Any]] = Field(default_factory=list, description="Identified sub-graphs or syndicate cells.")
    centralEntities: List[Dict[str, Any]] = Field(default_factory=list, description="Nodes with highest network centrality.")
    relationshipEvidence: List[Dict[str, Any]] = Field(default_factory=list, description="Evidentiary citations supporting discovered links.")


class Agent4HistoricalOutput(BaseModel):
    """Output produced by Agent 4: Historical & Pattern Intelligence Agent."""
    historicalMatches: List[Dict[str, Any]] = Field(default_factory=list, description="Precedent cases with similar Modus Operandi.")
    similarPatterns: List[Dict[str, Any]] = Field(default_factory=list, description="Recurring criminal operational patterns.")
    repeatedEntities: List[Dict[str, Any]] = Field(default_factory=list, description="Entities active in prior historical cases.")
    modusOperandiPatterns: List[str] = Field(default_factory=list, description="Extracted MO signatures.")
    crossCaseConnections: List[Dict[str, Any]] = Field(default_factory=list, description="Cross-jurisdictional connections discovered.")
    confidence: float = Field(default=0.85, description="Historical pattern confidence score.")


class AgentFinding(BaseModel):
    """Individual classified finding synthesized by Agent 5."""
    finding: str = Field(..., description="Analytical finding or conclusion.")
    classification: FindingClassification = Field(..., description="VERIFIED, SUPPORTED, POTENTIAL, or INSUFFICIENT DATA.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score.")
    evidence: List[str] = Field(default_factory=list, description="Evidentiary references supporting the finding.")
    agentSource: str = Field(..., description="Which agent or data stream identified this finding.")


class InvestigativeLead(BaseModel):
    """Actionable lead generated for the investigating officer."""
    lead: str = Field(..., description="Specific investigative recommendation.")
    urgency: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"] = Field(default="HIGH")
    recommendedAction: str = Field(..., description="Concrete step to execute.")
    basis: str = Field(..., description="Reasoning or evidence motivating the lead.")


class RiskIndicator(BaseModel):
    """Identified risk factor."""
    indicator: str = Field(..., description="Identified risk factor.")
    severity: Literal["HIGH", "MEDIUM", "LOW"] = Field(default="MEDIUM")
    rationale: str = Field(..., description="Explanation of the risk.")


class Agent5SynthesisOutput(BaseModel):
    """Output produced by Agent 5: Investigative Synthesis Agent."""
    investigationSummary: str = Field(..., description="Executive multi-agent investigation briefing.")
    keyFindings: List[AgentFinding] = Field(default_factory=list, description="Classified investigative findings.")
    importantEntities: List[Dict[str, Any]] = Field(default_factory=list)
    importantRelationships: List[Dict[str, Any]] = Field(default_factory=list)
    historicalConnections: List[Dict[str, Any]] = Field(default_factory=list)
    geographicIntelligence: List[Dict[str, Any]] = Field(default_factory=list)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)
    investigativeLeads: List[InvestigativeLead] = Field(default_factory=list)
    evidenceGaps: List[str] = Field(default_factory=list)
    riskIndicators: List[RiskIndicator] = Field(default_factory=list)
    disclaimer: str = Field(
        default="AI-assisted analysis. All findings require investigator verification.",
        description="Mandatory investigator review notice.",
    )


# ---------------------------------------------------------------------------
# Live Console Telemetry & Visual Metrics
# ---------------------------------------------------------------------------

TelemetryLevel = Literal["INFO", "WORK", "OK", "WARN", "ERROR"]


class TelemetryLine(BaseModel):
    """A single progressive console line emitted by an agent while it works."""
    ts: str = Field(..., description="HH:MM:SS.mmm emission timestamp.")
    level: TelemetryLevel = Field(default="INFO")
    text: str = Field(..., description="Human-readable console line.")
    detail: Optional[str] = Field(default=None, description="Optional secondary detail.")
    progress: Optional[int] = Field(default=None, ge=0, le=100, description="Optional sub-stage progress bar value.")


class AgentMetric(BaseModel):
    """A single headline number rendered as a visual metric tile."""
    label: str
    value: float
    unit: Optional[str] = None
    tone: Literal["neutral", "positive", "warning", "critical", "info"] = "neutral"
    hint: Optional[str] = None


# ---------------------------------------------------------------------------
# Data Source Ingestion (Step 2)
# ---------------------------------------------------------------------------

DataSourceState = Literal[
    "CONNECTED",
    "UPLOADED",
    "PROCESSING",
    "AWAITING_AUTHORIZATION",
    "NOT_AVAILABLE",
    "ERROR",
]


class DataSourceStatus(BaseModel):
    """Real connection/ingestion state of one investigation data source."""
    id: str
    name: str
    category: str = Field(..., description="DOCUMENT, TELECOM, SURVEILLANCE, FINANCIAL, VEHICLE, REGISTRY, ARCHIVE")
    state: DataSourceState = "NOT_AVAILABLE"
    recordCount: int = 0
    detail: str = ""
    uploadable: bool = False
    uploadKind: Optional[str] = Field(default=None, description="cdr | none — which upload endpoint accepts this source.")
    fileName: Optional[str] = None
    updatedAt: Optional[str] = None


# ---------------------------------------------------------------------------
# Communication (CDR) Intelligence — Sections 10 & 11
# ---------------------------------------------------------------------------

class CommunicationParty(BaseModel):
    """One phone number observed in the uploaded call detail records."""
    number: str
    displayName: Optional[str] = None
    role: str = Field(default="UNKNOWN CONTACT", description="Investigative role label.")
    totalCalls: int = 0
    totalSeconds: int = 0
    uniqueContacts: int = 0
    firstSeen: Optional[str] = None
    lastSeen: Optional[str] = None
    baselineCallsPerDay: float = 0.0
    peakCallsPerDay: int = 0
    isNewContact: bool = False
    matchedEntity: Optional[str] = None


class CommunicationLink(BaseModel):
    """Aggregated call flow between two numbers."""
    id: str
    source: str
    target: str
    calls: int
    totalSeconds: int = 0
    firstSeen: Optional[str] = None
    lastSeen: Optional[str] = None
    preIncidentCalls: int = 0


class SuspiciousPattern(BaseModel):
    """An anomalous communication pattern flagged for investigator review."""
    id: str
    patternType: Literal[
        "VOLUME_SPIKE",
        "DORMANT_REACTIVATION",
        "NEW_CONTACT_BEFORE_INCIDENT",
        "PRE_INCIDENT_BURST",
        "COMMUNICATION_CHAIN",
        "POST_INCIDENT_SILENCE",
        "ODD_HOUR_ACTIVITY",
    ]
    title: str
    partyA: str
    partyB: Optional[str] = None
    description: str
    baselineValue: float = 0.0
    observedValue: float = 0.0
    riskScore: float = Field(default=0.0, ge=0.0, le=1.0, description="Anomaly strength — NOT a probability of guilt.")
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"] = "MEDIUM"
    window: Optional[str] = None
    evidence: List[str] = Field(default_factory=list)


class DailyVolumePoint(BaseModel):
    date: str
    calls: int
    isIncidentDay: bool = False


class CDRAnalysis(BaseModel):
    """Full deterministic analysis of an uploaded call detail record set."""
    fileName: str
    uploadedAt: str
    totalRecords: int = 0
    parsedRecords: int = 0
    rejectedRecords: int = 0
    relevantRecords: int = 0
    filteredOut: int = 0
    uniqueNumbers: int = 0
    windowStart: Optional[str] = None
    windowEnd: Optional[str] = None
    incidentReference: Optional[str] = None
    parties: List[CommunicationParty] = Field(default_factory=list)
    links: List[CommunicationLink] = Field(default_factory=list)
    patterns: List[SuspiciousPattern] = Field(default_factory=list)
    dailyVolume: List[DailyVolumePoint] = Field(default_factory=list)
    columnsDetected: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Geographic & Temporal Intelligence (typed — replaces loose dicts)
# ---------------------------------------------------------------------------

class GeoIntelPoint(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    pointType: str = Field(default="LOCATION", description="CRIME_SCENE, LAST_SEEN, SUSPECT_RESIDENCE, VEHICLE_SIGHTING, EVIDENCE_RECOVERY, FINANCIAL_NODE, POSSIBLE_HIDEOUT, LOCATION")
    role: str = ""
    confidence: float = 0.9
    relatedEntities: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    sequence: Optional[int] = None


class GeoIntelLink(BaseModel):
    id: str
    sourceId: str
    targetId: str
    label: str
    kind: Literal["CONFIRMED", "POTENTIAL", "MOVEMENT", "HISTORICAL"] = "POTENTIAL"
    confidence: float = 0.8


class TimelineEvent(BaseModel):
    id: str
    time: str = Field(..., description="Display timestamp.")
    sortKey: str = Field(default="", description="ISO-ish key used for chronological ordering.")
    title: str
    description: str = ""
    eventType: str = Field(default="CASE", description="CASE, COMMUNICATION, MOVEMENT, EVIDENCE, HISTORICAL, ANALYSIS")
    source: str = "Case Record"
    agent: str = "SAMANVAYA"
    confidence: float = 0.9


# ---------------------------------------------------------------------------
# Agent Card Telemetry & Inspection Schema (Section 15)
# ---------------------------------------------------------------------------

class AgentCardData(BaseModel):
    """Detailed inspection payload for each of the 5 agents."""
    agentId: str = Field(..., description="agent-1, agent-2, etc.")
    agentNumber: int = Field(..., ge=1, le=5)
    name: str = Field(..., description="Official Agent Name.")
    sanskritName: str = Field(..., description="e.g. SANGRAHA / SOOCHNA.")
    role: str = Field(..., description="Domain specialization.")
    status: AgentStatus = Field(default="WAITING")
    recordsSearched: int = Field(default=0, description="Total candidate records scanned.")
    relevantFound: int = Field(default=0, description="High-signal records extracted.")
    executionTimeMs: float = Field(default=0.0, description="Processing duration in milliseconds.")
    inputSummary: str = Field(default="", description="Summary of input received from previous step.")
    processingDetails: str = Field(default="", description="Tasks and heuristics performed.")
    dataSources: List[str] = Field(default_factory=list, description="e.g. Redis, Neo4j, PostgreSQL, Historical Archive.")
    outputData: Dict[str, Any] = Field(default_factory=dict, description="Structured agent results.")
    evidence: List[str] = Field(default_factory=list, description="Cited evidentiary documents/logs.")
    limitations: List[str] = Field(default_factory=list, description="Uncertainties or gaps.")
    telemetry: List[TelemetryLine] = Field(default_factory=list, description="Progressive console lines emitted during this agent's pass.")
    metrics: List[AgentMetric] = Field(default_factory=list, description="Headline numbers rendered as visual metric tiles.")
    highlights: List[str] = Field(default_factory=list, description="Short, concrete findings produced by this agent.")
    handoff: str = Field(default="", description="What this agent passes forward to the next agent.")


# ---------------------------------------------------------------------------
# Advanced Investigation Graph (Section 7)
# ---------------------------------------------------------------------------

class SamanvayaGraphNode(BaseModel):
    id: str
    label: str
    name: str
    category: str  # CASE, PERSON, LOCATION, VEHICLE, PHONE, ORGANIZATION, FINANCIAL, HISTORICAL_CASE, EVIDENCE, LEAD
    importance: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"] = "HIGH"
    confidence: float = 0.95
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SamanvayaGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationshipType: str
    label: str
    confidence: float = 0.90
    evidence: List[str] = Field(default_factory=list)
    importance: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"] = "MEDIUM"

    @classmethod
    def model_validate(cls, obj: Any, *args, **kwargs):
        if isinstance(obj, dict) and isinstance(obj.get("evidence"), str):
            obj["evidence"] = [obj["evidence"]]
        return super().model_validate(obj, *args, **kwargs)


class SamanvayaGraphData(BaseModel):
    nodes: List[SamanvayaGraphNode] = Field(default_factory=list)
    edges: List[SamanvayaGraphEdge] = Field(default_factory=list)
    clusters: List[Dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Investigation Tree View (Section 8)
# ---------------------------------------------------------------------------

class TreeNodeRelation(BaseModel):
    """A summarized relationship rendered inside the tree node inspector."""
    label: str
    target: str
    kind: str = "ASSOCIATED_WITH"


class InvestigationTreeNode(BaseModel):
    id: str
    name: str
    type: str  # case, branch, suspect, person, phone, location, vehicle, financial, evidence, communication, historical, lead
    details: Optional[str] = None
    badge: Optional[str] = None
    confidence: Optional[float] = None
    subtitle: Optional[str] = Field(default=None, description="Short type/role caption rendered under the node name.")
    severity: Optional[Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]] = None
    facts: List[Dict[str, Any]] = Field(default_factory=list, description="label/value pairs shown in the node inspector.")
    relations: List[TreeNodeRelation] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    agentSource: Optional[str] = None
    children: List["InvestigationTreeNode"] = Field(default_factory=list)


# Self-referential model resolution
InvestigationTreeNode.model_rebuild()


class InvestigationTreeData(BaseModel):
    root: InvestigationTreeNode


# ---------------------------------------------------------------------------
# Pipeline Status & Master Dossier (Sections 12 & 16)
# ---------------------------------------------------------------------------

class SamanvayaPipelineStatus(BaseModel):
    caseId: str
    status: Literal["IDLE", "INITIALIZING", "RUNNING", "COMPLETED", "FAILED"] = "IDLE"
    currentAgentIndex: int = 0  # 0: Idle, 1..5: Active agent, 6: Completed
    currentAgentName: Optional[str] = None
    progress: int = 0  # 0 to 100%
    stageText: str = "Ready to initialize SAMANVAYA Multi-Agent Orchestrator"
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    agents: List[AgentCardData] = Field(default_factory=list)
    error: Optional[str] = None
    console: List[TelemetryLine] = Field(default_factory=list, description="Rolling master orchestrator console feed.")
    dataSources: List[DataSourceStatus] = Field(default_factory=list)


class SamanvayaFinalDossier(BaseModel):
    """Complete finalized SAMANVAYA intelligence payload."""
    caseId: str
    caseNumber: str
    caseTitle: str
    crimeCategory: str
    generatedAt: datetime
    executionDurationMs: float
    pipelineStatus: str = "COMPLETED"
    agents: List[AgentCardData]
    findings: List[AgentFinding]
    graph: SamanvayaGraphData
    tree: InvestigationTreeData
    geographicRoute: List[GeoIntelPoint] = Field(default_factory=list)
    geographicLinks: List[GeoIntelLink] = Field(default_factory=list)
    timeline: List[TimelineEvent] = Field(default_factory=list)
    investigativeLeads: List[InvestigativeLead]
    evidenceGaps: List[str]
    riskIndicators: List[RiskIndicator]
    investigationSummary: str = ""
    communications: Optional[CDRAnalysis] = None
    dataSources: List[DataSourceStatus] = Field(default_factory=list)
    reportText: str
    blockchainHash: Optional[str] = None
    cached: bool = False
