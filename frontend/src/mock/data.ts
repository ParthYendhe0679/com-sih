// ============================================================
// KRITAGAS — System Entity Data (Clean / Live-Only)
// ============================================================
import {
  Evidence, Vehicle, Phone, Location, Organization, Alert,
  TimelineEvent, ForensicRecord, Contradiction, WatchlistItem,
  HistoricalCase, HotspotData, PredictiveData, Transaction,
  SentinelSubject, AuditLogEntry, FIR, CrimeTrendData, NetworkNode, NetworkEdge
} from '@/types';

// Zero dummy data — all entity collections start clean and populate from live backend records
export const vehicles: Vehicle[] = [];
export const phones: Phone[] = [];
export const locations: Location[] = [];
export const organizations: Organization[] = [];
export const evidence: Evidence[] = [];
export const alerts: Alert[] = [];
export const timelineEvents: TimelineEvent[] = [];
export const forensicRecords: ForensicRecord[] = [];
export const contradictions: Contradiction[] = [];
export const watchlistItems: WatchlistItem[] = [];
export const historicalCases: HistoricalCase[] = [];
export const hotspotData: HotspotData[] = [];
export const predictiveData: PredictiveData[] = [];
export const sentinelSubjects: SentinelSubject[] = [];
export const transactions: Transaction[] = [];
export const crimeTrendData: CrimeTrendData[] = [];
export const auditLogs: AuditLogEntry[] = [];
export const networkNodes: NetworkNode[] = [];
export const networkEdges: NetworkEdge[] = [];
export const firs: FIR[] = [];
export const citizenComplaints: any[] = [];
export const liveEventsSeed: any[] = [];
export const liveSubjectSeed: any = null;
