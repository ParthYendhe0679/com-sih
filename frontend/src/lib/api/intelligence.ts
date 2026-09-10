import { apiClient } from './client';

// These mirror the backend's similarity schema exactly. They previously named
// fields that the API never returned (similar_cases / crime_type / summary), so
// every response looked empty and the Past Cases screen fell back to nothing.
export interface SimilarCaseItem {
  case_id: string;
  case_number: string;
  title: string;
  crime_category: string;
  status: string;
  incident_date?: string | null;
  similarity_score: number;
  semantic_score: number;
  modus_operandi_score: number;
  entity_overlap_score: number;
  location_score: number;
  temporal_score: number;
  explanation: string;
  matched_features: string[];
}

export interface CaseSimilarityResponse {
  source_case_id: string;
  source_case_number: string;
  total_candidates_analyzed: number;
  matches: SimilarCaseItem[];
  generated_at: string;
}

export interface IntelligenceInsight {
  id: string;
  insight_type: string;
  confidence_score: number;
  title: string;
  description: string;
  supporting_evidence?: string[];
  limitations?: string[];
  created_at?: string;
}

export interface CaseIntelligenceDossier {
  case_id: string;
  priority_score: number;
  risk_level: string;
  insights: IntelligenceInsight[];
  anomalies_count: number;
  correlations_count: number;
  similar_cases_count: number;
}

export interface PersonIntelligenceProfile {
  person_id: string;
  full_name?: string;
  risk_score: number;
  associated_cases: string[];
  associated_persons: string[];
  telecom_identifiers: string[];
  timeline_events: Array<{
    timestamp: string;
    description: string;
    case_id?: string;
  }>;
}

export interface AnalysisJobStatus {
  job_id: string;
  case_id: string;
  status: string;
  progress: number;
  current_stage: string;
  message?: string;
}

export const intelligenceApi = {
  getSimilarCases: async (caseId: string, topK: number = 5): Promise<CaseSimilarityResponse> => {
    return apiClient.get<CaseSimilarityResponse>(`/intelligence/cases/${caseId}/similar-cases`, {
      params: { top_k: topK },
    });
  },

  getCaseIntelligence: async (caseId: string): Promise<CaseIntelligenceDossier> => {
    return apiClient.get<CaseIntelligenceDossier>(`/intelligence/cases/${caseId}/intelligence`);
  },

  getCaseInsights: async (caseId: string): Promise<{ case_id: string; total: number; insights: IntelligenceInsight[] }> => {
    return apiClient.get<{ case_id: string; total: number; insights: IntelligenceInsight[] }>(`/intelligence/cases/${caseId}/insights`);
  },

  getCasePatterns: async (caseId: string): Promise<{ case_id: string; total: number; patterns: IntelligenceInsight[] }> => {
    return apiClient.get<{ case_id: string; total: number; patterns: IntelligenceInsight[] }>(`/intelligence/cases/${caseId}/patterns`);
  },

  getPersonIntelligence: async (personId: string): Promise<PersonIntelligenceProfile> => {
    return apiClient.get<PersonIntelligenceProfile>(`/intelligence/persons/${personId}/intelligence`);
  },

  analyzeCase: async (caseId: string): Promise<AnalysisJobStatus> => {
    return apiClient.post<AnalysisJobStatus>(`/intelligence/cases/${caseId}/analyze`);
  },

  getJobStatus: async (jobId: string): Promise<AnalysisJobStatus> => {
    return apiClient.get<AnalysisJobStatus>(`/intelligence/analysis/jobs/${jobId}`);
  },
};
