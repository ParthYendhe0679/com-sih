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

export const casesApi = {
  async listCases(params?: {
    status?: string;
    priority?: string;
    page?: number;
    size?: number;
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
};
