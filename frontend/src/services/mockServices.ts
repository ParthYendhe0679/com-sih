// ============================================================
// KRITAGAS — Mock Service Layer
// ============================================================
import { cases } from '@/mock/cases';
import { people } from '@/mock/people';
import {
  vehicles, phones, locations, organizations, evidence, alerts,
  timelineEvents, forensicRecords, contradictions, watchlistItems,
  historicalCases, hotspotData, predictiveData, sentinelSubjects,
  transactions, crimeTrendData, auditLogs, networkNodes, networkEdges, firs,
} from '@/mock/data';
import { delay } from '@/lib/utils';
import type { Case, Person, Vehicle, Evidence, Alert, FIR, ForensicRecord, TimelineEvent, HistoricalCase, HotspotData, PredictiveData, SentinelSubject, Contradiction, WatchlistItem, Organization, Location, Phone, Transaction, NetworkNode, NetworkEdge, AuditLogEntry, CrimeTrendData, AIMessage } from '@/types';

// ---------- Case Service ----------
export const mockCaseService = {
  async getCases(): Promise<Case[]> { await delay(400); return cases; },
  async getCase(id: string): Promise<Case | undefined> { await delay(300); return cases.find(c => c.id === id); },
  async getCasesByStatus(status: string): Promise<Case[]> { await delay(300); return cases.filter(c => c.status === status); },
};

// ---------- Person Service ----------
export const mockPersonService = {
  async getPeople(): Promise<Person[]> { await delay(350); return people; },
  async getPerson(id: string): Promise<Person | undefined> { await delay(200); return people.find(p => p.id === id); },
  async getPeopleByCase(caseId: string): Promise<Person[]> { await delay(300); return people.filter(p => p.caseIds.includes(caseId)); },
};

// ---------- Vehicle Service ----------
export const mockVehicleService = {
  async getVehicles(): Promise<Vehicle[]> { await delay(300); return vehicles; },
  async getVehicle(id: string): Promise<Vehicle | undefined> { await delay(200); return vehicles.find(v => v.id === id); },
  async getVehiclesByCase(caseId: string): Promise<Vehicle[]> { await delay(250); return vehicles.filter(v => v.caseIds.includes(caseId)); },
};

// ---------- Phone Service ----------
export const mockPhoneService = {
  async getPhones(): Promise<Phone[]> { await delay(300); return phones; },
  async getPhone(id: string): Promise<Phone | undefined> { await delay(200); return phones.find(p => p.id === id); },
};

// ---------- Location Service ----------
export const mockLocationService = {
  async getLocations(): Promise<Location[]> { await delay(300); return locations; },
  async getLocation(id: string): Promise<Location | undefined> { await delay(200); return locations.find(l => l.id === id); },
  async getLocationsByCase(caseId: string): Promise<Location[]> { await delay(250); return locations.filter(l => l.caseIds.includes(caseId)); },
};

// ---------- Organization Service ----------
export const mockOrganizationService = {
  async getOrganizations(): Promise<Organization[]> { await delay(300); return organizations; },
  async getOrganization(id: string): Promise<Organization | undefined> { await delay(200); return organizations.find(o => o.id === id); },
};

// ---------- Evidence Service ----------
export const mockEvidenceService = {
  async getEvidence(): Promise<Evidence[]> { await delay(400); return evidence; },
  async getEvidenceById(id: string): Promise<Evidence | undefined> { await delay(200); return evidence.find(e => e.id === id); },
  async getEvidenceByCase(caseId: string): Promise<Evidence[]> { await delay(300); return evidence.filter(e => e.caseId === caseId); },
  async verifyIntegrity(id: string): Promise<{ verified: boolean; hash: string }> {
    await delay(2000);
    const ev = evidence.find(e => e.id === id);
    return { verified: true, hash: ev?.integrity.hash || '' };
  },
};

// ---------- FIR Service ----------
export const mockFirService = {
  async getFirs(): Promise<FIR[]> { await delay(400); return firs; },
  async getFir(id: string): Promise<FIR | undefined> { await delay(300); return firs.find(f => f.id === id); },
  async analyzeFir(id: string): Promise<{ ocrConfidence: number; entityConfidence: number }> {
    await delay(3000);
    return { ocrConfidence: 96, entityConfidence: 91 };
  },
};

// ---------- Alert Service ----------
export const mockAlertService = {
  async getAlerts(): Promise<Alert[]> { await delay(350); return alerts; },
  async getAlertsByCase(caseId: string): Promise<Alert[]> { await delay(300); return alerts.filter(a => a.caseId === caseId); },
  async resolveAlert(id: string): Promise<void> { await delay(500); },
  async getUnreadCount(): Promise<number> { await delay(100); return alerts.filter(a => !a.read).length; },
};

// ---------- Timeline Service ----------
export const mockTimelineService = {
  async getTimelineEvents(caseId: string): Promise<TimelineEvent[]> { await delay(400); return timelineEvents.filter(t => t.caseId === caseId); },
  async getAllTimeline(): Promise<TimelineEvent[]> { await delay(350); return timelineEvents; },
};

// ---------- Network Service ----------
export const mockNetworkService = {
  async getNetwork(caseId: string): Promise<{ nodes: NetworkNode[]; edges: NetworkEdge[] }> {
    await delay(600);
    return { nodes: [], edges: [] };
  },
  async getEntityNetwork(entityId: string): Promise<{ nodes: NetworkNode[]; edges: NetworkEdge[] }> {
    await delay(500);
    const relevantEdges = networkEdges.filter(e => e.source === entityId || e.target === entityId);
    const nodeIds = new Set<string>();
    nodeIds.add(entityId);
    relevantEdges.forEach(e => { nodeIds.add(e.source); nodeIds.add(e.target); });
    const relevantNodes = networkNodes.filter(n => nodeIds.has(n.id));
    return { nodes: relevantNodes, edges: relevantEdges };
  },
  async getRelationshipExplanation(entity1: string, entity2: string) {
    await delay(800);
    const edge = networkEdges.find(e =>
      (e.source === entity1 && e.target === entity2) || (e.source === entity2 && e.target === entity1)
    );
    return {
      entity1, entity2,
      relationship: edge?.relationship || 'ASSOCIATED_WITH',
      confidence: edge?.confidence || 50,
      evidenceBasis: edge?.evidenceBasis || [],
      sharedLocations: [],
      sharedOrganizations: [],
      sharedVehicles: [],
      reason: edge ? 'Direct relationship corroborated by evidence records.' : 'No corroborated relationship currently logged between these entities in the active graph.',
    };
  },
};

// ---------- Forensic Service ----------
export const mockForensicService = {
  async getForensicRecords(): Promise<ForensicRecord[]> { await delay(400); return forensicRecords; },
  async getForensicRecord(id: string): Promise<ForensicRecord | undefined> { await delay(200); return forensicRecords.find(f => f.id === id); },
  async getForensicsByCase(caseId: string): Promise<ForensicRecord[]> { await delay(300); return forensicRecords.filter(f => f.caseId === caseId); },
};

// ---------- Historical Service ----------
export const mockHistoricalService = {
  async search(query: string): Promise<HistoricalCase[]> {
    await delay(800);
    return historicalCases.filter(h =>
      h.title?.toLowerCase().includes(query.toLowerCase()) ||
      h.crime?.toLowerCase().includes(query.toLowerCase())
    );
  },
  async getHistoricalCase(id: string): Promise<HistoricalCase | undefined> { await delay(300); return historicalCases.find(h => h.id === id); },
  async getAllHistorical(): Promise<HistoricalCase[]> { await delay(500); return historicalCases; },
};

// ---------- Sentinel Service ----------
export const mockSentinelService = {
  async getSubjects(): Promise<SentinelSubject[]> { await delay(500); return sentinelSubjects; },
  async getSubject(personId: string): Promise<SentinelSubject | undefined> { await delay(300); return sentinelSubjects.find(s => s.personId === personId); },
};

// ---------- Contradiction Service ----------
export const mockContradictionService = {
  async getContradictions(caseId?: string): Promise<Contradiction[]> {
    await delay(400);
    if (caseId) return contradictions.filter(c => c.caseId === caseId);
    return contradictions;
  },
};

// ---------- Watchlist Service ----------
export const mockWatchlistService = {
  async getWatchlist(): Promise<WatchlistItem[]> { await delay(300); return watchlistItems; },
};

// ---------- Map Service ----------
export const mockMapService = {
  async getMapLocations(caseId?: string): Promise<Location[]> {
    await delay(400);
    if (caseId) return locations.filter(l => l.caseIds.includes(caseId));
    return locations;
  },
  async getHotspots(): Promise<HotspotData[]> { await delay(500); return hotspotData; },
};

// ---------- Analytics Service ----------
export const mockAnalyticsService = {
  async getCrimeTrends(): Promise<CrimeTrendData[]> { await delay(400); return crimeTrendData; },
  async getPredictiveData(): Promise<PredictiveData[]> { await delay(500); return predictiveData; },
  async getHotspots(): Promise<HotspotData[]> { await delay(500); return hotspotData; },
  async getAuditLogs(): Promise<AuditLogEntry[]> { await delay(300); return auditLogs; },
};

// ---------- Transaction Service ----------
export const mockTransactionService = {
  async getTransactions(caseId?: string): Promise<Transaction[]> {
    await delay(300);
    if (caseId) return transactions.filter(t => t.caseId === caseId);
    return transactions;
  },
};

// ---------- AI Service ----------
const aiResponses: Record<string, { answer: string; entities: { id: string; name: string; type: string }[]; cases: string[]; confidence: number }> = {};

export const mockAIService = {
  async ask(question: string): Promise<AIMessage> {
    await delay(800);
    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: `### KAVA AI Investigation Query Analysis\n\n**Query:** "${question}"\n\nNo active entities or corroborated relationships are currently indexed in the intelligence knowledge graph matching your search scope.\n\nTo initiate multi-modal AI correlation:\n1. Register a First Information Report (FIR) in the Police Intake workspace.\n2. Ingest forensic documents, digital evidence, or vehicle telemetry.\n3. Run autonomous agent correlation via SAMANVAYA or graph synthesis.\n\n⚠️ Note: All findings generated by KAVA AI require formal investigator verification.`,
      timestamp: new Date().toISOString(),
      sources: [],
      entities: [],
      confidence: 0,
    };
  },

  getSuggestedQuestions(): string[] {
    return [
      'Summarize active case dossier',
      'Identify high-degree centrality entities',
      'Analyze cross-entity relationships',
      'Correlate timeline events and evidence items',
      'Detect geographic movement patterns',
    ];
  },
};

// ---------- Global Search ----------
export const mockSearchService = {
  async search(query: string): Promise<{ type: string; id: string; title: string; subtitle: string }[]> {
    await delay(200);
    const q = query.toLowerCase();
    const results: { type: string; id: string; title: string; subtitle: string }[] = [];

    cases.filter(c => c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.crime.toLowerCase().includes(q))
      .slice(0, 5).forEach(c => results.push({ type: 'Case', id: c.id, title: c.title, subtitle: `${c.id} · ${c.crime} · ${c.city}` }));

    people.filter(p => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 5).forEach(p => results.push({ type: 'Person', id: p.id, title: p.name, subtitle: `${p.id} · ${p.role} · ${p.city}` }));

    vehicles.filter(v => v.id.toLowerCase().includes(q) || v.registrationNumber.toLowerCase().includes(q))
      .slice(0, 3).forEach(v => results.push({ type: 'Vehicle', id: v.id, title: v.registrationNumber, subtitle: `${v.id} · ${v.make} ${v.model}` }));

    evidence.filter(e => e.id.toLowerCase().includes(q) || e.title.toLowerCase().includes(q))
      .slice(0, 3).forEach(e => results.push({ type: 'Evidence', id: e.id, title: e.title, subtitle: `${e.id} · ${e.type}` }));

    organizations.filter(o => o.id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q))
      .slice(0, 3).forEach(o => results.push({ type: 'Organization', id: o.id, title: o.name, subtitle: `${o.id} · ${o.type}` }));

    locations.filter(l => l.id.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q))
      .slice(0, 3).forEach(l => results.push({ type: 'Location', id: l.id, title: l.name, subtitle: `${l.id} · ${l.city}` }));

    firs.filter(f => f.id.toLowerCase().includes(q))
      .slice(0, 2).forEach(f => results.push({ type: 'FIR', id: f.id, title: f.id, subtitle: `${f.policeStation} · ${f.crimeType}` }));

    return results;
  },
};
