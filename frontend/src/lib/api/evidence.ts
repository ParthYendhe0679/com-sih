// ============================================================
// TRINETRA — Evidence Service API
// ============================================================

import { apiClient } from './client';
import type { PaginatedResult } from './firs';

export interface BackendEvidence {
  id: string;
  case_id?: string | null;
  fir_id?: string | null;
  title: string;
  description?: string | null;
  evidence_type: 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FORENSIC' | 'DIGITAL';
  file_name: string;
  file_url: string;
  file_hash: string;
  file_size: number;
  mime_type: string;
  collected_at?: string;
  created_at: string;
}

export const evidenceApi = {
  async listCaseEvidence(
    caseId: string,
    params?: { page?: number; size?: number }
  ): Promise<PaginatedResult<BackendEvidence>> {
    return await apiClient.get<PaginatedResult<BackendEvidence>>(`/evidence/case/${caseId}`, { params });
  },

  async listFirEvidence(
    firId: string,
    params?: { page?: number; size?: number }
  ): Promise<PaginatedResult<BackendEvidence>> {
    return await apiClient.get<PaginatedResult<BackendEvidence>>(`/evidence/fir/${firId}`, { params });
  },

  async getEvidenceById(id: string): Promise<BackendEvidence> {
    return await apiClient.get<BackendEvidence>(`/evidence/${id}`);
  },

  async addEvidence(data: {
    case_id?: string;
    fir_id?: string;
    title: string;
    description?: string;
    evidence_type: 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FORENSIC' | 'DIGITAL';
    file_name: string;
    file_url: string;
    file_hash: string;
    file_size: number;
    mime_type: string;
  }): Promise<BackendEvidence> {
    return await apiClient.post<BackendEvidence>('/evidence', data);
  },
};
