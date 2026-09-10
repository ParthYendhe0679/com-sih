// ============================================================
// TRINETRA — Core Type Definitions
// ============================================================

// --- Enums ---

export type CaseStatus = 'Active' | 'Under Investigation' | 'Pending Review' | 'Closed' | 'Archived';
export type CasePriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type CrimeType = 'Robbery' | 'Fraud' | 'Kidnapping' | 'Murder' | 'Extortion' | 'Drug Trafficking' | 'Vehicle Theft' | 'Cybercrime' | 'Assault' | 'Arms Trafficking' | 'Money Laundering' | 'Human Trafficking';
export type EvidenceType = 'FIR' | 'PDF' | 'Image' | 'Video' | 'CCTV' | 'Transaction' | 'Report' | 'Document';
export type EvidenceStatus = 'Collected' | 'Under Analysis' | 'Verified' | 'Flagged' | 'Archived';
export type AlertSeverity = 'Info' | 'Review' | 'High Priority';
export type AlertType = 'New FIR Connection' | 'Network Relationship' | 'Historical Match' | 'Evidence Contradiction' | 'Anomaly Detected' | 'Crime Trend Increase' | 'CCTV Observation' | 'Watchlist Event';
export type ForensicCategory = 'DNA' | 'Fingerprint' | 'Ballistics' | 'Toxicology' | 'Digital Forensics';
export type EntityType = 'Person' | 'Vehicle' | 'Phone' | 'Location' | 'Organization' | 'Case';
export type RelationshipType = 'INVOLVED_IN' | 'ASSOCIATED_WITH' | 'USED' | 'LOCATED_AT' | 'CONNECTED_TO' | 'MENTIONED_IN' | 'OWNS' | 'TRANSFERRED_TO' | 'SUPPORTED_BY';
export type WatchlistStatus = 'Active' | 'Paused' | 'Removed';

// --- Core Entities ---

export interface Case {
  id: string;
  /** Stable backend UUID. `id` remains the human-readable case number for display. */
  backendId?: string;
  title: string;
  crime: CrimeType;
  location: string;
  city: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedOfficer: string;
  created: string;
  lastActivity: string;
  description: string;
  firId: string;
  personIds: string[];
  vehicleIds: string[];
  phoneIds: string[];
  locationIds: string[];
  organizationIds: string[];
  evidenceIds: string[];
  alertIds: string[];
}

export interface Person {
  id: string;
  name: string;
  alias?: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  city: string;
  phone: string;
  occupation: string;
  role: string; // Complainant, Suspect, Witness, Person of Interest, Victim
  caseIds: string[];
  vehicleIds: string[];
  phoneIds: string[];
  organizationIds: string[];
  associatedPersonIds: string[];
  photo?: string;
}

export interface Vehicle {
  id: string;
  type: string;
  make: string;
  model: string;
  color: string;
  registrationNumber: string;
  ownerPersonId: string;
  caseIds: string[];
  observations: VehicleObservation[];
}

export interface VehicleObservation {
  date: string;
  location: string;
  coordinates: [number, number];
  source: string;
}

export interface Phone {
  id: string;
  number: string;
  imei: string;
  carrier: string;
  ownerPersonId: string;
  caseIds: string[];
  cdrRecords: CDRRecord[];
}

export interface CDRRecord {
  date: string;
  time: string;
  duration: number;
  type: 'Incoming' | 'Outgoing' | 'SMS';
  otherNumber: string;
  towerLocation: string;
  coordinates: [number, number];
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  type: string; // Residence, Business, Crime Scene, Observation Point
  coordinates: [number, number];
  caseIds: string[];
  personIds: string[];
  crimeTypes: CrimeType[];
  incidents: number;
}

export interface Organization {
  id: string;
  name: string;
  type: string; // Business, NGO, Shell Company, Financial Institution
  address: string;
  city: string;
  registrationNumber: string;
  personIds: string[];
  caseIds: string[];
  status: 'Active' | 'Under Investigation' | 'Suspended' | 'Dissolved';
}

export interface Evidence {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  source: string;
  date: string;
  caseId: string;
  personIds: string[];
  status: EvidenceStatus;
  integrity: {
    hash: string;
    verified: boolean;
    verifiedDate: string;
  };
  metadata: Record<string, string>;
}

export interface ForensicRecord {
  id: string;
  category: ForensicCategory;
  caseId: string;
  evidenceId: string;
  candidatePersonId: string;
  matchPercentage: number;
  status: 'Pending' | 'In Progress' | 'Complete' | 'Requires Examiner Verification';
  analyst: string;
  date: string;
  details: string;
}

export interface FIR {
  id: string;
  caseId: string;
  policeStation: string;
  crimeType: CrimeType;
  date: string;
  location: string;
  city: string;
  complainant: string;
  complainantPersonId: string;
  ocrText: string;
  extractedEntities: ExtractedEntities;
  aiAnalysis: AIFIRAnalysis;
}

export interface ExtractedEntities {
  people: { name: string; role: string; confidence: number }[];
  vehicles: { description: string; registration: string; confidence: number }[];
  phones: { number: string; context: string; confidence: number }[];
  locations: { name: string; type: string; confidence: number }[];
  organizations: { name: string; type: string; confidence: number }[];
  dates: { date: string; context: string; confidence: number }[];
  transactions: { amount: string; context: string; confidence: number }[];
}

export interface AIFIRAnalysis {
  summary: string;
  crimeClassification: { type: string; confidence: number }[];
  keyEntities: { name: string; type: string; relevance: string }[];
  importantLocations: { name: string; significance: string }[];
  importantDates: { date: string; significance: string }[];
  potentialRelationships: { entity1: string; entity2: string; basis: string; confidence: number }[];
  historicalMatches: { caseId: string; similarity: number; reason: string }[];
  patternIndicators: { pattern: string; confidence: number; description: string }[];
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  caseId: string;
  entityId?: string;
  entityType?: EntityType;
  date: string;
  read: boolean;
  resolved: boolean;
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  timestamp: string;
  title: string;
  description: string;
  type: string;
  entityId?: string;
  entityType?: EntityType;
  icon: string;
}

export interface WatchlistItem {
  id: string;
  entityId: string;
  entityType: EntityType;
  entityName: string;
  reason: string;
  createdBy: string;
  createdDate: string;
  status: WatchlistStatus;
}

export interface HistoricalCase {
  id: string;
  title: string;
  year: number;
  crime: CrimeType;
  location: string;
  city: string;
  status: CaseStatus;
  similarity: number;
  relatedCaseId?: string;
  sharedEntities: string[];
  sharedLocations: string[];
  reason: string;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: EntityType | 'Case' | 'FIR' | 'Evidence' | 'Transaction';
  data: Record<string, unknown>;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  relationship: RelationshipType;
  evidenceBasis: string[];
  confidence: number;
  caseIds: string[];
}

export interface NetworkAnalytics {
  entityId: string;
  connectionCount: number;
  degreeCentrality: number;
  betweenness: number;
  pageRank: number;
  community: number;
}

export interface Contradiction {
  id: string;
  caseId: string;
  type: string;
  sourceA: { id: string; type: string; value: string; date: string };
  sourceB: { id: string; type: string; value: string; date: string };
  description: string;
  severity: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Under Review' | 'Dismissed' | 'Resolved';
}

export interface SentinelSubject {
  personId: string;
  name: string;
  baselineActivity: { startHour: number; endHour: number; typicalLocations: string[]; typicalVehicles: string[] };
  recentActivity: SentinelObservation[];
  anomalyScore: number;
  status: 'Normal' | 'Changed Pattern' | 'Anomaly Detected';
}

export interface SentinelObservation {
  date: string;
  time: string;
  location: string;
  activity: string;
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface HotspotData {
  id: string;
  area: string;
  city: string;
  state: string;
  coordinates: [number, number];
  crimeCount: number;
  crimeTypes: { type: CrimeType; count: number }[];
  trend: 'Increasing' | 'Stable' | 'Decreasing';
  recentFIRs: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface PredictiveData {
  area: string;
  city: string;
  crimeType: CrimeType;
  trend: 'Increasing' | 'Stable' | 'Decreasing';
  forecast: string;
  probability: number;
  peakPeriod: string;
  recommendation: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  timestamp: string;
  ipAddress: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  email: string;
  badge: string;
  department: string;
  avatar?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: { id: string; type: string; title: string }[];
  entities?: { id: string; name: string; type: string }[];
  confidence?: number;
}

export interface CrimeTrendData {
  month: string;
  robbery: number;
  fraud: number;
  kidnapping: number;
  murder: number;
  vehicleTheft: number;
  cybercrime: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  fromEntity: string;
  toEntity: string;
  type: string;
  caseId: string;
  status: 'Verified' | 'Suspicious' | 'Under Review';
}

// ---------- Citizen Portal Types ----------
export type ComplaintStatus =
  | 'Submitted'
  | 'Under Verification'
  | 'Verified'
  | 'Converted to FIR'
  | 'Investigation'
  | 'Closed';

export interface CitizenComplaint {
  id: string; // CMP-2026-XXXX
  complainantName: string;
  phone: string;
  email: string;
  crimeType: CrimeType;
  description: string;
  location: string;
  city: string;
  date: string;
  time: string;
  status: ComplaintStatus;
  evidenceFiles: string[];
  assignedStation: string;
  convertedFirId?: string;
  convertedCaseId?: string;
  investigatorNotes: { date: string; officer: string; note: string }[];
}

// ---------- Live Monitoring Types ----------
export type LiveEventType =
  | 'CCTV Observation'
  | 'Vehicle Detected'
  | 'Entity Movement'
  | 'Location Change'
  | 'New Relationship'
  | 'Historical Match'
  | 'Anomaly Detected'
  | 'Evidence Received';

export interface LiveEvent {
  id: string;
  timestamp: string;
  type: LiveEventType;
  entityId: string;
  entityType: EntityType | 'Case' | 'Evidence';
  title: string;
  details: string;
  location: string;
  city: string;
  coordinates: [number, number];
  severity: 'info' | 'warning' | 'critical';
}

export interface LiveSubject {
  personId: string;
  name: string;
  status: 'MONITORED' | 'ALERT' | 'STANDBY';
  currentLocation: string;
  lastObservationTime: string;
  vehicleId: string;
  associatedEntities: string[];
  anomalyScore: number;
  alertsCount: number;
  caseId: string;
}

export interface MapLayerSettings {
  crimeIncidents: boolean;
  firLocations: boolean;
  caseLocations: boolean;
  people: boolean;
  vehicles: boolean;
  cctv: boolean;
  historicalCases: boolean;
  watchlist: boolean;
  liveObservations: boolean;
  hotspots: boolean;
}
