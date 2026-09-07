// ============================================================
// KRITAGAS — FIR & Complaint Intake Service API
// ============================================================

import { apiClient } from './client';

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  total_pages: number;
}

export interface BackendFIR {
  id: string;
  fir_number: string;
  title: string;
  description?: string;
  crime_category: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'MORE_INFORMATION_REQUIRED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  incident_date: string;
  incident_time?: string | null;
  incident_location: string;
  submitted_by_id: string;
  reviewed_by_id?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  is_offline: boolean;
  document_name?: string | null;
  document_type?: string | null;
  document_url?: string | null;
  processing_status?: 'NOT_PROCESSED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  case_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface UploadFirResponse {
  fir: BackendFIR;
  file_url: string;
  file_hash: string;
  file_size: number;
  extracted_text: string;
  entities: {
    phones: { number: string; confidence: number }[];
    vehicles: { registration: string; confidence: number }[];
    transactions: { amount: string; confidence: number }[];
    legal_sections: { section: string; confidence: number }[];
    emails: { email: string; confidence: number }[];
  };
  processing_status: string;
}

export const firsApi = {
  async listFirs(params?: {
    status?: string;
    priority?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResult<BackendFIR>> {
    return await apiClient.get<PaginatedResult<BackendFIR>>('/firs', { params });
  },

  async getMyFirs(params?: {
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResult<BackendFIR>> {
    return await apiClient.get<PaginatedResult<BackendFIR>>('/firs/my-firs', { params });
  },

  async getFirById(id: string): Promise<BackendFIR> {
    return await apiClient.get<BackendFIR>(`/firs/${id}`);
  },

  async createCitizenFir(
    data: {
      title: string;
      description: string;
      crime_category: string;
      incident_date: string;
      incident_time?: string;
      incident_location: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    },
    submitNow = false
  ): Promise<BackendFIR> {
    return await apiClient.post<BackendFIR>('/firs', data, {
      params: { submit_now: submitNow },
    });
  },

  async submitFir(firId: string): Promise<BackendFIR> {
    return await apiClient.post<BackendFIR>(`/firs/${firId}/submit`);
  },

  async reviewFir(
    firId: string,
    data: {
      status: 'ACCEPTED' | 'REJECTED' | 'MORE_INFORMATION_REQUIRED' | 'UNDER_REVIEW';
      rejection_reason?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      remarks?: string;
    }
  ): Promise<BackendFIR> {
    return await apiClient.post<BackendFIR>(`/firs/${firId}/review`, data);
  },

  async getPoliceQueue(params?: {
    status?: string;
    priority?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResult<BackendFIR>> {
    return await apiClient.get<PaginatedResult<BackendFIR>>('/police/fir-queue', { params });
  },

  async uploadOfflineFir(formData: FormData): Promise<UploadFirResponse> {
    return await apiClient.upload<UploadFirResponse>('/police/upload-fir-document', formData);
  },
};
