// ============================================================
// KRITAGAS — Multi-Entity Search Service API
// ============================================================

import { apiClient } from './client';
import type { BackendCase } from './cases';
import type { BackendFIR } from './firs';

export interface SearchResults {
  firs: BackendFIR[];
  cases: BackendCase[];
  total_matches: number;
  query: string;
}

export const searchApi = {
  async search(query: string, limit = 20): Promise<SearchResults> {
    if (!query || !query.trim()) {
      return { firs: [], cases: [], total_matches: 0, query: '' };
    }
    return await apiClient.get<SearchResults>('/search', {
      params: { q: query.trim(), limit },
    });
  },
};
