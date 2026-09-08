// ============================================================
// KRITAGAS — Investigation Cases Service API
// ============================================================

import { apiClient } from './client';
import type { PaginatedResult } from './firs';

export interface BackendCaseNote {
  id: string;
  case_id: string;
  author_id: string;
  note: string;
  created_at: string;
}

export interface BackendCase {
  id: string;
  case_number: string;
  title: string;
  description: string;
  crime_category: string;
  status: 'OPEN' | 'UNDER_INVESTIGATION' | 'PENDING_FORENSICS' | 'CHARGESHEET_FILED' | 'CLOSED' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fir_id?: string | null;
  lead_investigator_id?: string | null;
  created_by_id: string;
  opened_at: string;
  closed_at?: string | null;
  created_at: string;
  updated_at?: string;
  notes?: BackendCaseNote[];
  evidence_count?: number;
  city?: string | null;
  region?: string | null;
  police_station?: string | null;
  area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CaseTimelineEvent {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  description: string;
  created_at: string;
  actor_id?: string | null;
}

export interface CaseNetworkData {
  case_id: string;
  case_number: string;
  nodes: {
    id: string;
    label: string;
    type: string;
    data?: any;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    relationship: string;
    confidence: number;
  }[];
  total_nodes: number;
  total_edges: number;
}

export interface CaseEntityItem {
  id: string;
  entity_type: string;
  name: string;
  normalized_value: string;
  confidence: number;
  role: string;
  attributes?: Record<string, any>;
  source_text?: string;
}

export interface CaseEntitiesData {
  case_id: string;
  case_number: string;
  total_entities: number;
  counts: {
    persons: number;
    phones: number;
    vehicles: number;
    financials: number;
    legal_sections: number;
    locations: number;
    digital_identifiers: number;
  };
  categorized: {
    persons: CaseEntityItem[];
    phones: CaseEntityItem[];
    vehicles: CaseEntityItem[];
    financials: CaseEntityItem[];
    legal_sections: CaseEntityItem[];
    locations: CaseEntityItem[];
    digital_identifiers: CaseEntityItem[];
  };
  entities: CaseEntityItem[];
}

export interface CaseRelationshipItem {
  id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  target_id: string;
  target_name: string;
  target_type: string;
  relationship_type: string;
  confidence: number;
  evidence_basis: string;
}

export interface CaseRelationshipsData {
  case_id: string;
  total_relationships: number;
  relationships: CaseRelationshipItem[];
}

export type CaseListItem = BackendCase;

export const casesApi = {
  async listCases(params?: {
    status?: string;
    priority?: string;
    page?: number;
    size?: number;
    search?: string;
  }): Promise<PaginatedResult<BackendCase>> {
    return await apiClient.get<PaginatedResult<BackendCase>>('/cases', { params });
  },

  async getMyCases(params?: {
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResult<BackendCase>> {
    return await apiClient.get<PaginatedResult<BackendCase>>('/cases/my-cases', { params });
  },

  async getCaseById(id: string): Promise<BackendCase> {
    return await apiClient.get<BackendCase>(`/cases/${id}`);
  },

  async createCase(data: {
    title: string;
    description: string;
    crime_category: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    fir_id?: string;
  }): Promise<BackendCase> {
    return await apiClient.post<BackendCase>('/cases', data);
  },

  async createCaseFromFir(firId: string): Promise<BackendCase> {
    return await apiClient.post<BackendCase>(`/cases/from-fir/${firId}`);
  },

  async updateCaseStatus(
    caseId: string,
    status: 'OPEN' | 'UNDER_INVESTIGATION' | 'PENDING_FORENSICS' | 'CHARGESHEET_FILED' | 'CLOSED' | 'ARCHIVED',
    note?: string
  ): Promise<BackendCase> {
    return await apiClient.post<BackendCase>(`/cases/${caseId}/status`, { status, note });
  },

  async assignInvestigator(caseId: string, leadInvestigatorId: string): Promise<BackendCase> {
    return await apiClient.post<BackendCase>(`/cases/${caseId}/assign`, {
      lead_investigator_id: leadInvestigatorId,
    });
  },

  async addCaseNote(caseId: string, note: string): Promise<BackendCaseNote> {
    return await apiClient.post<BackendCaseNote>(`/cases/${caseId}/notes`, { note });
  },

  async getCaseTimeline(caseId: string): Promise<CaseTimelineEvent[]> {
    return await apiClient.get<CaseTimelineEvent[]>(`/cases/${caseId}/timeline`);
  },

  async getCaseNetwork(caseId: string): Promise<CaseNetworkData> {
    return await apiClient.get<CaseNetworkData>(`/cases/${caseId}/network`);
  },

  async syncCaseGraph(caseId: string): Promise<{ nodes_synced: number; edges_synced: number; status: string; message: string }> {
    return await apiClient.post(`/graph/cases/${caseId}/graph/sync`);
  },

  async getGraphAnalytics(caseId: string): Promise<any> {
    return await apiClient.get(`/graph/analytics/${caseId}`);
  },

  async getHiddenConnections(caseId: string): Promise<any[]> {
    return await apiClient.get(`/graph/hidden-connections?case_id=${caseId}`);
  },

  async getSharedResources(caseId?: string): Promise<any[]> {
    const url = caseId ? `/graph/shared-resources?case_id=${caseId}` : '/graph/shared-resources';
    return await apiClient.get(url);
  },

  async getCaseEntities(caseId: string): Promise<CaseEntitiesData> {
    return await apiClient.get<CaseEntitiesData>(`/cases/${caseId}/entities`);
  },

  async getCaseRelationships(caseId: string): Promise<CaseRelationshipsData> {
    return await apiClient.get<CaseRelationshipsData>(`/cases/${caseId}/relationships`);
  },
};

