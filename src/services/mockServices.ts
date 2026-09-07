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
    if (caseId === 'CASE-102') return { nodes: networkNodes, edges: networkEdges };
    return { nodes: networkNodes.slice(0, 5), edges: networkEdges.slice(0, 4) };
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
      sharedLocations: ['LOC-087'],
      sharedOrganizations: ['ORG-014'],
      sharedVehicles: [],
      reason: 'Both entities appear in investigation records and share a referenced organization (Nexus Trading Corp). Financial transaction records indicate fund flow between associated accounts.',
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
    if (query.includes('CASE-102') || query.includes('PERSON-014') || query.includes('Mehta')) {
      return historicalCases.filter(h => (h.similarity || 0) > 60);
    }
    return historicalCases.slice(0, 10);
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
const aiResponses: Record<string, { answer: string; entities: { id: string; name: string; type: string }[]; cases: string[]; confidence: number }> = {
  'show all kidnapping cases in mumbai': {
    answer: 'I found 3 kidnapping cases in Mumbai metropolitan area within the current dataset. The most recent is CASE-028 (Missing Person Investigation) which is currently active with Medium priority. The cases involve different operational areas within Mumbai suburbs.',
    entities: [{ id: 'PERSON-034', name: 'Chirag Bhatt', type: 'Person' }],
    cases: ['CASE-028'],
    confidence: 85,
  },
  'which person has the highest number of connections': {
    answer: 'Based on network analysis, PERSON-014 (Aarav Mehta) has the highest number of connections with 15 direct relationships across the investigation network. He is connected to 6 organizations, 5 other persons of interest, 2 vehicles, and 2 locations. His degree centrality score is 0.48, making him the most highly connected entity in the current investigation scope.',
    entities: [{ id: 'PERSON-014', name: 'Aarav Mehta', type: 'Person' }, { id: 'PERSON-021', name: 'Vikram Sharma', type: 'Person' }],
    cases: ['CASE-102', 'CASE-087'],
    confidence: 92,
  },
  'find historical cases related to case-102': {
    answer: 'I identified 3 historical cases with significant similarity to CASE-102:\n\n1. **CASE-087** (Westside Financial Fraud Ring, 2023) — 89% similarity. Shares entities PERSON-014 and PERSON-021, overlapping locations, and similar fraud methodology.\n\n2. **HC-003** (Pune Real Estate Scam, 2024) — 74% similarity. Similar property fraud through undervaluation in Pune region, shares PERSON-016.\n\n3. **HC-005** (Kolkata Ponzi Scheme, 2023) — 55% similarity. Financial fraud pattern through banking channels.\n\nThe strongest match is CASE-087, which shares the same principal entities and operational pattern.',
    entities: [{ id: 'PERSON-014', name: 'Aarav Mehta', type: 'Person' }, { id: 'PERSON-021', name: 'Vikram Sharma', type: 'Person' }],
    cases: ['CASE-087', 'HC-003', 'HC-005'],
    confidence: 91,
  },
  'show all firs involving person-014': {
    answer: 'PERSON-014 (Aarav Mehta) is mentioned in 2 FIRs:\n\n1. **FIR-2026-0102** (CASE-102) — Filed on 15-Aug-2026 at Juhu PS. Money Laundering / Financial Fraud involving Nexus Trading Corp. Aarav Mehta is named as primary suspect/director.\n\n2. **FIR-2023-0087** (CASE-087) — Filed on 12-Mar-2023 at Bandra PS. Historical fraud case (now closed) where Mehta was identified as person of interest.',
    entities: [{ id: 'PERSON-014', name: 'Aarav Mehta', type: 'Person' }],
    cases: ['CASE-102', 'CASE-087'],
    confidence: 95,
  },
  'which areas show increasing robbery activity': {
    answer: 'Based on crime trend analysis, the following areas show increasing robbery activity:\n\n1. **Connaught Place, Delhi** — 52 total crimes, robbery up significantly. Peak hours: 18:00-22:00. Severity: Critical.\n\n2. **Andheri West, Mumbai** — 45 total crimes with 12 robberies. Trend: Increasing. Severity: High.\n\n3. **Karol Bagh, Delhi** — 42 total crimes with 12 robberies. Peak hours: evening. Severity: Critical.\n\nRecommendation: Enhanced surveillance and rapid response capability recommended for these areas during peak hours.',
    entities: [],
    cases: [],
    confidence: 88,
  },
  'why are person-014 and person-021 connected': {
    answer: 'PERSON-014 (Aarav Mehta) and PERSON-021 (Vikram Sharma) are connected through multiple investigative dimensions:\n\n**Organizational Link:** Both are listed as directors of Nexus Trading Corp (ORG-014) — confidence: 95%.\n\n**Financial Link:** Bank records show fund transfers between accounts associated with both individuals through Nexus Trading Corp and Westline Logistics Ltd — confidence: 82%.\n\n**Communication Link:** CDR analysis reveals sustained phone communication between PHONE-014 and PHONE-021 — confidence: 78%.\n\n**Historical Link:** Both appear in closed case CASE-087 (Westside Financial Fraud Ring, 2023) — confidence: 89%.\n\n**Location Co-occurrence:** Both observed at Nexus Trading Corp office (LOC-087) on multiple occasions — confidence: 92%.\n\nOverall relationship confidence: **82%**\n\n⚠️ Note: This analysis indicates potential investigative relevance. Investigator verification recommended.',
    entities: [{ id: 'PERSON-014', name: 'Aarav Mehta', type: 'Person' }, { id: 'PERSON-021', name: 'Vikram Sharma', type: 'Person' }, { id: 'ORG-014', name: 'Nexus Trading Corp', type: 'Organization' }],
    cases: ['CASE-102', 'CASE-087'],
    confidence: 82,
  },
  'show evidence supporting this relationship': {
    answer: 'Evidence supporting the relationship between PERSON-014 and PERSON-021:\n\n1. **EVIDENCE-045** — Company Registration Document: Shows both as directors of Nexus Trading Corp.\n\n2. **EVIDENCE-046** — Bank Transfer Records: ₹4.7 Crore in transfers between entities linked to both individuals.\n\n3. **EVIDENCE-047** — CCTV Footage: Both observed entering Nexus Trading Corp office on multiple dates.\n\n4. **EVIDENCE-049** — Financial Analysis Report: Forensic accountant identifies fund flow patterns connecting accounts of both.\n\n5. **EVIDENCE-052** — Cash Deposit Records: Pattern of structured deposits below reporting threshold in PERSON-021 accounts, with source tracing to PERSON-014-linked entities.\n\n6. **EVIDENCE-056** — Phone CDR Analysis: 342 communication records showing sustained contact.\n\n7. **EVIDENCE-088** — Historical Investigation Report (CASE-087): Both named in 2023 financial fraud case.\n\nTotal: 7 evidence items across financial, documentary, surveillance, and communication categories.',
    entities: [{ id: 'EVIDENCE-045', name: 'Registration Doc', type: 'Evidence' }, { id: 'EVIDENCE-046', name: 'Bank Transfers', type: 'Evidence' }, { id: 'EVIDENCE-049', name: 'Financial Report', type: 'Evidence' }],
    cases: ['CASE-102'],
    confidence: 88,
  },
  'summarize case-102': {
    answer: '### CASE-102 Summary: Organized Financial Fraud Investigation\n\n- **Crime Category:** Organized Financial Fraud & PMLA Contravention\n- **Status:** Active Investigation (Assigned: DCP R. Sharma)\n- **Locus:** Andheri West, Mumbai & Pune Deccan Corridor\n- **Origin:** FIR-2026-0102 lodged on 15-Aug-2026 by complainant Manoj Tiwari\n- **Primary Entities:** Karan Verma (PERSON-019), Rahul Thakur (PERSON-016), Nisha Kapoor (PERSON-015), and M/s Nexus Trading Corp (ORG-014)\n- **Factual Core:** Inducement of ₹4.70 Cr commercial property acquisition at Versova Business Centre with ₹1.26 Cr advance routed across shell accounts\n- **Assets Flagged:** Mercedes-Benz E-Class (MH-01-AB-1234), Toyota Innova (MH-02-CD-4567)\n- **Current Intelligence:** 31 network nodes, 55 relationships, 4 detected fraud sub-clusters, and 3 archival matches.\n\n⚠️ Note: System output provides analytical assistance; human investigator verification is required.',
    entities: [{ id: 'PERSON-019', name: 'Karan Verma', type: 'Person' }, { id: 'PERSON-016', name: 'Rahul Thakur', type: 'Person' }, { id: 'ORG-014', name: 'Nexus Trading Corp', type: 'Organization' }],
    cases: ['CASE-102'],
    confidence: 96,
  },
  'who are the most connected individuals': {
    answer: '### Top Connected Individuals in Case Scope:\n\n1. **Karan Verma (PERSON-019)** — 18 direct connections. Degree Centrality: 0.52. Linked to 6 shell entities, 4 co-conspirators, 2 vehicles, and 3 historical case records.\n2. **Aarav Mehta (PERSON-014)** — 15 direct connections. Degree Centrality: 0.48. Primary corporate signatory across 4 bank escrow conduits.\n3. **Rahul Thakur (PERSON-016)** — 12 direct connections. Degree Centrality: 0.44. Manages transport logistics and vehicle movement across Mumbai-Pune highway.\n4. **Nisha Kapoor (PERSON-015)** — 11 direct connections. Degree Centrality: 0.41. Property seller counter-party in previous Versova transfers.\n5. **Vikram Sharma (PERSON-021)** — 12 direct connections. Intermediary director in Westline Logistics accounts.',
    entities: [{ id: 'PERSON-019', name: 'Karan Verma', type: 'Person' }, { id: 'PERSON-014', name: 'Aarav Mehta', type: 'Person' }, { id: 'PERSON-016', name: 'Rahul Thakur', type: 'Person' }],
    cases: ['CASE-102', 'CASE-087'],
    confidence: 94,
  },
  'show connections between karan verma and rahul': {
    answer: '### Cross-Entity Connections: Karan Verma ↔ Rahul Thakur\n\n1. **Telephony Intercept (CDR):** 18 direct calls logged between +91 98765 XXXXX (Karan Verma) and +91 99887 XXXXX (Rahul Thakur) within 48 hours of escrow liquidation.\n2. **Historical Case Co-occurrence:** Both individuals recorded as associates in closed case **CASE-087** (Westside Financial Fraud Ring, 2023).\n3. **Co-location Sightings:** Both subjects observed departing Bandra Bandstand meeting point in convoy vehicles MH-01-AB-1234 and MH-02-CD-4567.\n4. **Corporate Tie:** Cross-holding links between Nexus Trading Corp and GlobalProp Realty Pvt Ltd.\n\n- **Overall Link Strength:** High (87% confidence)\n- **Primary Evidence:** CDR logs, ANPR toll surveillance, and ROC Director filings.',
    entities: [{ id: 'PERSON-019', name: 'Karan Verma', type: 'Person' }, { id: 'PERSON-016', name: 'Rahul Thakur', type: 'Person' }],
    cases: ['CASE-102', 'CASE-087'],
    confidence: 87,
  },
  'what evidence connects these two people': {
    answer: '### Evidentiary Proof Linking Subjects:\n\n1. **EVIDENCE-048 (CDR Extraction):** Complete call ledger showing 18 outgoing and incoming calls with average duration 4.2 minutes.\n2. **EVIDENCE-047 (ANPR Surveillance):** Camera capture at Khalapur Toll Plaza (Km 38) timestamped 14:43 showing convoy movement.\n3. **EVIDENCE-045 (Corporate Articles):** ROC registry document linking common registered address at 22 Juhu Tara Road.\n4. **EVIDENCE-046 (Bank Wire Slips):** Wire transfer of ₹25L referencing mutual shell accounts.\n5. **EVIDENCE-088 (Historical Case Record):** Joint interrogation statement from 2023 Bandra investigation.',
    entities: [{ id: 'EVIDENCE-047', name: 'Toll ANPR CCTV', type: 'Evidence' }, { id: 'EVIDENCE-048', name: 'CDR Extraction', type: 'Evidence' }, { id: 'EVIDENCE-045', name: 'ROC Articles', type: 'Evidence' }],
    cases: ['CASE-102', 'CASE-087'],
    confidence: 92,
  },
  'find important locations': {
    answer: '### Crucial Geographic Vectors for Investigation:\n\n1. **22 Juhu Tara Road, Juhu, Mumbai (LOC-087):** Registered corporate headquarters of Nexus Trading Corp. Multiple subject sightings recorded.\n2. **Versova Business Centre, Andheri West:** Alleged locus of commercial property fraud; crime scene per FIR-2026-0102.\n3. **Khalapur Toll Plaza (Mumbai-Pune Expressway Km 38):** High-speed ANPR camera point where suspect vehicle MH-01-AB-1234 was logged departing Mumbai at 14:43.\n4. **55 FC Road, Deccan Gymkhana, Pune (LOC-023):** Branch operations base for GlobalProp Realty Pvt Ltd.\n5. **Bandra Bandstand Promenade:** Meeting point observed 48 hours prior to transaction execution.',
    entities: [{ id: 'LOC-087', name: 'Juhu Tara Road', type: 'Location' }, { id: 'LOC-023', name: 'FC Road, Pune', type: 'Location' }],
    cases: ['CASE-102'],
    confidence: 93,
  },
  'show historical cases related to this case': {
    answer: '### Correlated Historical Cases (Pattern Match):\n\n1. **CASE-087 (Westside Financial Fraud Ring, 2023):**\n   - **Similarity:** 87%\n   - **Shared Factors:** Karan Verma, Rahul Thakur, Vehicle MH-01-AB-1234, and identical property undervaluation MO.\n\n2. **CASE-041 (Offshore Shell Entity Network, 2024):**\n   - **Similarity:** 74%\n   - **Shared Factors:** Common Chartered Accountant Divya Saxena, shell bank conduit structure, and phone number reference.\n\n3. **CASE-004 (Delhi Construction Land Fraud, 2026):**\n   - **Similarity:** 68%\n   - **Shared Factors:** Interstate hawala transfers between Mumbai and Delhi NCR.',
    entities: [{ id: 'CASE-087', name: 'Westside Ring', type: 'Case' }, { id: 'CASE-041', name: 'Offshore Shell', type: 'Case' }],
    cases: ['CASE-087', 'CASE-041', 'CASE-004'],
    confidence: 91,
  },
  'what suspicious patterns exist': {
    answer: '### Detected Suspicious Analytical Patterns:\n\n1. **Financial Funnel Anomaly:** ₹1.26 Crore moved from primary corporate escrow into 3 disparate regional accounts within 48 hours of receipt without corresponding trade invoices.\n2. **Alibi Contradiction:** Written statement claimed subject was in Pune continuously, but ANPR toll cameras recorded vehicle MH-01-AB-1234 on expressway at 14:43.\n3. **Pre-Crime Communication Spike:** Call frequency between Karan Verma and Rahul Thakur increased by 400% in the 72 hours preceding complainant advance payment.\n4. **Cross-Case Modus Operandi Match:** Property transfer mechanics mirror exactly the methodology used in closed case CASE-087.\n\n⚠️ Analytical finding only. Requires independent human investigator verification.',
    entities: [{ id: 'EVIDENCE-047', name: 'ANPR Toll Record', type: 'Evidence' }, { id: 'TXN-001', name: 'Wire Transfer', type: 'Financial' }],
    cases: ['CASE-102'],
    confidence: 89,
  },
};

export const mockAIService = {
  async ask(question: string): Promise<AIMessage> {
    await delay(1200);
    const lowerQ = question.toLowerCase();
    const matchedKey = Object.keys(aiResponses).find(k => lowerQ.includes(k) || k.includes(lowerQ.slice(0, 20)));

    if (matchedKey) {
      const resp = aiResponses[matchedKey];
      return {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: resp.answer,
        timestamp: new Date().toISOString(),
        sources: resp.cases.map(c => ({ id: c, type: 'Case', title: c })),
        entities: resp.entities,
        confidence: resp.confidence,
      };
    }

    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: `### KAVA AI Investigation Query Analysis\n\n**Query:** "${question}"\n\nBased on cross-case correlation of 128 active cases, 100 entities, and 150 evidence items:\n\n- **Target Case Context:** CASE-102 (Organized Financial Fraud Investigation)\n- **Primary Correlated Entities:** Karan Verma (PERSON-019), Rahul Thakur (PERSON-016), Nexus Trading Corp (ORG-014)\n- **Key Corroborating Sources:** FIR-2026-0102, ANPR Toll Surveillance, and Bank Wire Audit Ledgers\n\nFor more specific tactical analysis, try asking:\n- *"Summarize CASE-102"*\n- *"Who are the most connected individuals?"*\n- *"Show connections between Karan Verma and Rahul"*\n- *"What evidence connects these two people?"*\n- *"Find important locations"*\n- *"Show historical cases related to this case"*\n- *"What suspicious patterns exist?"*\n\n⚠️ Note: All analytical findings require verified investigator signoff.`,
      timestamp: new Date().toISOString(),
      sources: [{ id: 'CASE-102', type: 'Case', title: 'CASE-102' }],
      confidence: 75,
    };
  },

  getSuggestedQuestions(): string[] {
    return [
      'Summarize CASE-102',
      'Who are the most connected individuals?',
      'Show connections between Karan Verma and Rahul.',
      'What evidence connects these two people?',
      'Find important locations.',
      'Show historical cases related to this case.',
      'What suspicious patterns exist?',
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
