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

export interface CaseMapIntelligenceNode {
  id: string;
  entityId?: string;
  type: string;
  label: string;
  name: string;
  address?: string;
  city?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  latitude: number;
  longitude: number;
  importance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  geocoded: boolean;
  metadata?: Record<string, any>;
}

export interface CaseMapUnmappedLocation {
  id: string;
  name: string;
  type: string;
  reason: string;
  importance: string;
  confidence: number;
}

export interface CaseMapIntelligenceRelationship {
  id: string;
  source: string;
  target: string;
  sourceName?: string;
  targetName?: string;
  type: string;
  label: string;
  importance: string;
  confidence: number;
  evidenceBasis: string[];
}

export interface CaseMapIntelligenceData {
  caseId: string;
  caseNumber: string;
  crimeCategory: string;
  nodes: CaseMapIntelligenceNode[];
  unmappedLocations: CaseMapUnmappedLocation[];
  relationships: CaseMapIntelligenceRelationship[];
  stats: {
    totalLocations: number;
    geocodedLocations: number;
    unmappedLocations: number;
    relationshipsCount: number;
  };
  source: string;
  cached: boolean;
}

export type CaseListItem = BackendCase;

// Fast Client-Side Cache (SWR Pattern)
const _CLIENT_CASE_CACHE = new Map<string, { data: any; timestamp: number }>();
const CLIENT_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export function invalidateClientCaseCache(caseId?: string): void {
  if (!caseId) {
    _CLIENT_CASE_CACHE.clear();
  } else {
    for (const key of Array.from(_CLIENT_CASE_CACHE.keys())) {
      if (key.includes(caseId)) {
        _CLIENT_CASE_CACHE.delete(key);
      }
    }
  }
}

export const casesApi = {
  getCachedCases(): BackendCase[] | null {
    const cacheKey = `cases:list:{"size":50}`;
    const cached = _CLIENT_CASE_CACHE.get(cacheKey) || _CLIENT_CASE_CACHE.get(`cases:list:{}`);
    if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL && cached.data?.items) {
      return cached.data.items;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('kritagas_cases_list_cache');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (_) {}
    }
    return null;
  },

  getCachedCase(idOrNumber: string): BackendCase | null {
    const cached = _CLIENT_CASE_CACHE.get(`cases:detail:${idOrNumber}`);
    if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL && cached.data) {
      return cached.data as BackendCase;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('kritagas_cases_list_cache');
        if (stored) {
          const list: BackendCase[] = JSON.parse(stored);
          const found = list.find((c) => c.id === idOrNumber || c.case_number === idOrNumber);
          if (found) return found;
        }
      } catch (_) {}
    }
    return null;
  },

  async listCases(params?: {
    status?: string;
    priority?: string;
    page?: number;
    size?: number;
    search?: string;
  }): Promise<PaginatedResult<BackendCase>> {
    const cacheKey = `cases:list:${JSON.stringify(params || {})}`;
    const cached = _CLIENT_CASE_CACHE.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.data as PaginatedResult<BackendCase>;
    }
    const result = await apiClient.get<PaginatedResult<BackendCase>>('/cases', { params });
    _CLIENT_CASE_CACHE.set(cacheKey, { data: result, timestamp: now });
    // Also warm individual item caches
    if (result && Array.isArray(result.items)) {
      for (const item of result.items) {
        if (item.id) _CLIENT_CASE_CACHE.set(`cases:detail:${item.id}`, { data: item, timestamp: now });
        if (item.case_number) _CLIENT_CASE_CACHE.set(`cases:detail:${item.case_number}`, { data: item, timestamp: now });
      }
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('kritagas_cases_list_cache', JSON.stringify(result.items.slice(0, 50)));
        } catch (_) {}
      }
    }
    return result;
  },

  async getMyCases(params?: {
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResult<BackendCase>> {
    return await apiClient.get<PaginatedResult<BackendCase>>('/cases/my-cases', { params });
  },

  async getCaseById(id: string): Promise<BackendCase> {
    const cacheKey = `cases:detail:${id}`;
    const cached = _CLIENT_CASE_CACHE.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.data as BackendCase;
    }
    const result = await apiClient.get<BackendCase>(`/cases/${id}`);
    _CLIENT_CASE_CACHE.set(cacheKey, { data: result, timestamp: now });
    if (result.id) _CLIENT_CASE_CACHE.set(`cases:detail:${result.id}`, { data: result, timestamp: now });
    if (result.case_number) _CLIENT_CASE_CACHE.set(`cases:detail:${result.case_number}`, { data: result, timestamp: now });
    return result;
  },

  async createCase(data: {
    title: string;
    description: string;
    crime_category: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    fir_id?: string;
  }): Promise<BackendCase> {
    invalidateClientCaseCache();
    return await apiClient.post<BackendCase>('/cases', data);
  },

  async createCaseFromFir(firId: string): Promise<BackendCase> {
    invalidateClientCaseCache();
    return await apiClient.post<BackendCase>(`/cases/from-fir/${firId}`);
  },

  async updateCaseStatus(
    caseId: string,
    status: 'OPEN' | 'UNDER_INVESTIGATION' | 'PENDING_FORENSICS' | 'CHARGESHEET_FILED' | 'CLOSED' | 'ARCHIVED',
    note?: string
  ): Promise<BackendCase> {
    invalidateClientCaseCache(caseId);
    return await apiClient.post<BackendCase>(`/cases/${caseId}/status`, { status, note });
  },

  async assignInvestigator(caseId: string, leadInvestigatorId: string): Promise<BackendCase> {
    invalidateClientCaseCache(caseId);
    return await apiClient.post<BackendCase>(`/cases/${caseId}/assign`, {
      lead_investigator_id: leadInvestigatorId,
    });
  },

  async addCaseNote(caseId: string, note: string): Promise<BackendCaseNote> {
    invalidateClientCaseCache(caseId);
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
    const cacheKey = `cases:entities:${caseId}`;
    const cached = _CLIENT_CASE_CACHE.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.data as CaseEntitiesData;
    }
    const result = await apiClient.get<CaseEntitiesData>(`/cases/${caseId}/entities`);
    _CLIENT_CASE_CACHE.set(cacheKey, { data: result, timestamp: now });
    return result;
  },

  async getCaseRelationships(caseId: string): Promise<CaseRelationshipsData> {
    const cacheKey = `cases:relationships:${caseId}`;
    const cached = _CLIENT_CASE_CACHE.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.data as CaseRelationshipsData;
    }
    const result = await apiClient.get<CaseRelationshipsData>(`/cases/${caseId}/relationships`);
    _CLIENT_CASE_CACHE.set(cacheKey, { data: result, timestamp: now });
    return result;
  },

  async getCaseMapIntelligence(caseId: string): Promise<CaseMapIntelligenceData> {
    const cacheKey = `cases:map:${caseId}`;
    const cached = _CLIENT_CASE_CACHE.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.data as CaseMapIntelligenceData;
    }
    const result = await apiClient.get<CaseMapIntelligenceData>(`/cases/${caseId}/map-intelligence`);
    _CLIENT_CASE_CACHE.set(cacheKey, { data: result, timestamp: now });
    return result;
  },

};
