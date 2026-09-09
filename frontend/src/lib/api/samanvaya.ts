// ============================================================
// KRITAGAS — SAMANVAYA Multi-Agent Intelligence API Client
// ============================================================

import { apiClient } from './client';

export type FindingClassification = 'VERIFIED' | 'SUPPORTED' | 'POTENTIAL' | 'INSUFFICIENT DATA';
export type AgentStatus = 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type TelemetryLevel = 'INFO' | 'WORK' | 'OK' | 'WARN' | 'ERROR';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TelemetryLine {
  ts: string;
  level: TelemetryLevel;
  text: string;
  detail?: string | null;
  progress?: number | null;
}

export interface AgentMetric {
  label: string;
  value: number;
  unit?: string | null;
  tone: 'neutral' | 'positive' | 'warning' | 'critical' | 'info';
  hint?: string | null;
}

export interface AgentCardData {
  agentId: string;
  agentNumber: number;
  name: string;
  sanskritName: string;
  role: string;
  status: AgentStatus;
  recordsSearched: number;
  relevantFound: number;
  executionTimeMs: number;
  inputSummary: string;
  processingDetails: string;
  dataSources: string[];
  outputData: Record<string, any>;
  evidence: string[];
  limitations: string[];
  telemetry: TelemetryLine[];
  metrics: AgentMetric[];
  highlights: string[];
  handoff: string;
}

export interface AgentFinding {
  finding: string;
  classification: FindingClassification;
  confidence: number;
  evidence: string[];
  agentSource: string;
}

export interface InvestigativeLead {
  lead: string;
  urgency: Severity;
  recommendedAction: string;
  basis: string;
}

export interface RiskIndicator {
  indicator: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string;
}

// ── Data source ingestion ────────────────────────────────────
export type DataSourceState =
  | 'CONNECTED'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'AWAITING_AUTHORIZATION'
  | 'NOT_AVAILABLE'
  | 'ERROR';

export interface DataSourceStatus {
  id: string;
  name: string;
  category: string;
  state: DataSourceState;
  recordCount: number;
  detail: string;
  uploadable: boolean;
  uploadKind?: string | null;
  fileName?: string | null;
  updatedAt?: string | null;
}

// ── Communication (CDR) intelligence ─────────────────────────
export interface CommunicationParty {
  number: string;
  displayName?: string | null;
  role: string;
  totalCalls: number;
  totalSeconds: number;
  uniqueContacts: number;
  firstSeen?: string | null;
  lastSeen?: string | null;
  baselineCallsPerDay: number;
  peakCallsPerDay: number;
  isNewContact: boolean;
  matchedEntity?: string | null;
}

export interface CommunicationLink {
  id: string;
  source: string;
  target: string;
  calls: number;
  totalSeconds: number;
  firstSeen?: string | null;
  lastSeen?: string | null;
  preIncidentCalls: number;
}

export interface SuspiciousPattern {
  id: string;
  patternType: string;
  title: string;
  partyA: string;
  partyB?: string | null;
  description: string;
  baselineValue: number;
  observedValue: number;
  riskScore: number;
  severity: Severity;
  window?: string | null;
  evidence: string[];
}

export interface DailyVolumePoint {
  date: string;
  calls: number;
  isIncidentDay: boolean;
}

export interface CDRAnalysis {
  fileName: string;
  uploadedAt: string;
  totalRecords: number;
  parsedRecords: number;
  rejectedRecords: number;
  relevantRecords: number;
  filteredOut: number;
  uniqueNumbers: number;
  windowStart?: string | null;
  windowEnd?: string | null;
  incidentReference?: string | null;
  parties: CommunicationParty[];
  links: CommunicationLink[];
  patterns: SuspiciousPattern[];
  dailyVolume: DailyVolumePoint[];
  columnsDetected: string[];
  notes: string[];
}

// ── Graph ────────────────────────────────────────────────────
export interface SamanvayaGraphNode {
  id: string;
  label: string;
  name: string;
  category: string;
  importance: Severity;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface SamanvayaGraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: string;
  label: string;
  confidence: number;
  evidence: string[];
  importance: Severity;
}

export interface SamanvayaGraphData {
  nodes: SamanvayaGraphNode[];
  edges: SamanvayaGraphEdge[];
  clusters: Array<Record<string, any>>;
}

// ── Investigation tree ───────────────────────────────────────
export interface TreeNodeRelation {
  label: string;
  target: string;
  kind: string;
}

export interface InvestigationTreeNode {
  id: string;
  name: string;
  type: string;
  details?: string | null;
  badge?: string | null;
  confidence?: number | null;
  subtitle?: string | null;
  severity?: Severity | null;
  facts: Array<{ label: string; value: any }>;
  relations: TreeNodeRelation[];
  evidence: string[];
  agentSource?: string | null;
  children: InvestigationTreeNode[];
}

export interface InvestigationTreeData {
  root: InvestigationTreeNode;
}

// ── Geo & timeline ───────────────────────────────────────────
export interface GeoIntelPoint {
  id: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  pointType: string;
  role: string;
  confidence: number;
  relatedEntities: string[];
  evidence: string[];
  sequence?: number | null;
}

export interface GeoIntelLink {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  kind: 'CONFIRMED' | 'POTENTIAL' | 'MOVEMENT' | 'HISTORICAL';
  confidence: number;
}

export interface TimelineEvent {
  id: string;
  time: string;
  sortKey: string;
  title: string;
  description: string;
  eventType: string;
  source: string;
  agent: string;
  confidence: number;
}

// ── Pipeline & dossier ───────────────────────────────────────
export interface SamanvayaPipelineStatus {
  caseId: string;
  status: 'IDLE' | 'INITIALIZING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  currentAgentIndex: number;
  currentAgentName?: string;
  progress: number;
  stageText: string;
  startedAt?: string;
  completedAt?: string;
  agents: AgentCardData[];
  error?: string;
  console: TelemetryLine[];
  dataSources: DataSourceStatus[];
}

export interface SamanvayaFinalDossier {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  crimeCategory: string;
  generatedAt: string;
  executionDurationMs: number;
  pipelineStatus: string;
  agents: AgentCardData[];
  findings: AgentFinding[];
  graph: SamanvayaGraphData;
  tree: InvestigationTreeData;
  geographicRoute: GeoIntelPoint[];
  geographicLinks: GeoIntelLink[];
  timeline: TimelineEvent[];
  investigativeLeads: InvestigativeLead[];
  evidenceGaps: string[];
  riskIndicators: RiskIndicator[];
  investigationSummary: string;
  communications?: CDRAnalysis | null;
  dataSources: DataSourceStatus[];
  reportText: string;
  blockchainHash?: string;
  cached: boolean;
}

export interface SamanvayaReportResponse {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  reportText: string;
  blockchainHash?: string;
  generatedAt: string;
  findingsCount: number;
  leadsCount: number;
}

export const samanvayaApi = {
  /** Start the SAMANVAYA 5-agent sequential investigation pipeline. */
  async startPipeline(caseId: string, sync: boolean = false) {
    return apiClient.post<Record<string, any>>(
      `/intelligence/cases/${caseId}/start`,
      undefined,
      { params: { sync } }
    );
  },

  /** Poll current pipeline telemetry and execution progress. */
  async getPipelineStatus(caseId: string): Promise<SamanvayaPipelineStatus> {
    return apiClient.get<SamanvayaPipelineStatus>(`/intelligence/cases/${caseId}/status`);
  },

  /** Finalized dossier — null when the pipeline has never been run for this case. */
  async getFinalResults(caseId: string): Promise<SamanvayaFinalDossier | null> {
    return apiClient.get<SamanvayaFinalDossier | null>(`/intelligence/cases/${caseId}/results`);
  },

  async getAgentCards(caseId: string): Promise<AgentCardData[]> {
    return apiClient.get<AgentCardData[]>(`/intelligence/cases/${caseId}/agents`);
  },

  async getInvestigationGraph(caseId: string): Promise<SamanvayaGraphData | null> {
    return apiClient.get<SamanvayaGraphData | null>(`/intelligence/cases/${caseId}/graph`);
  },

  async getInvestigationTree(caseId: string): Promise<InvestigationTreeData | null> {
    return apiClient.get<InvestigationTreeData | null>(`/intelligence/cases/${caseId}/tree`);
  },

  async getInvestigationReport(caseId: string): Promise<SamanvayaReportResponse> {
    return apiClient.get<SamanvayaReportResponse>(`/intelligence/cases/${caseId}/report`);
  },

  // ── Data source ingestion ──────────────────────────────────
  async getDataSources(caseId: string): Promise<DataSourceStatus[]> {
    return apiClient.get<DataSourceStatus[]>(`/intelligence/cases/${caseId}/data-sources`);
  },

  /** Upload a CSV/JSON call detail record export for this case. */
  async uploadCallRecords(caseId: string, file: File): Promise<CDRAnalysis> {
    const form = new FormData();
    form.append('file', file);
    return apiClient.upload<CDRAnalysis>(`/intelligence/cases/${caseId}/data-sources/cdr`, form);
  },

  async getCallRecords(caseId: string): Promise<CDRAnalysis | null> {
    return apiClient.get<CDRAnalysis | null>(`/intelligence/cases/${caseId}/data-sources/cdr`);
  },

  async deleteCallRecords(caseId: string): Promise<{ caseId: string }> {
    return apiClient.delete<{ caseId: string }>(`/intelligence/cases/${caseId}/data-sources/cdr`);
  },
};
