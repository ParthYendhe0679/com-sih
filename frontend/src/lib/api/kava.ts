// ============================================================
// KRITAGAS — KAVA AI Chat API Client
// ============================================================

import { apiClient } from './client';

export interface KavaChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface KavaChatRequest {
  caseId: string;
  message: string;
  history?: KavaChatMessage[];
}

export interface KavaChatResponse {
  answer: string;
  sources: string[];
  groundingLevel: 'FULL' | 'PARTIAL' | 'LIMITED' | 'ERROR' | 'NONE';
  contextStats: {
    caseNumber?: string;
    crimeCategory?: string;
    caseStatus?: string;
    entityCount?: number;
    relationshipCount?: number;
    evidenceCount?: number;
    cdrRecords?: number;
    timelineEvents?: number;
    agentCount?: number;
    samanvayaComplete?: boolean;
  };
  intents?: string[];
}

export const kavaApi = {
  async chat(req: KavaChatRequest): Promise<KavaChatResponse> {
    return apiClient.post<KavaChatResponse>('/kava/chat', {
      caseId: req.caseId,
      message: req.message,
      history: req.history ?? [],
    });
  },
};
