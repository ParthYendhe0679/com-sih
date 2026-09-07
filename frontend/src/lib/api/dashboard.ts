// ============================================================
// KRITAGAS — Dashboard Analytics Service API
// ============================================================

import { apiClient } from './client';
import type { BackendCase } from './cases';
import type { BackendFIR } from './firs';

export interface PoliceDashboardStats {
  assigned_cases_count: number;
  open_cases_count: number;
  pending_fir_reviews_count: number;
  urgent_cases_count: number;
  recent_cases: BackendCase[];
  recent_firs: BackendFIR[];
}

export interface CitizenDashboardStats {
  total_complaints: number;
  submitted_complaints: number;
  under_review_complaints: number;
  accepted_complaints: number;
  rejected_complaints: number;
  recent_complaints: BackendFIR[];
  unread_notifications_count: number;
}

export interface AdminDashboardStats {
  total_users: number;
  total_firs: number;
  total_cases: number;
  total_evidence: number;
  active_police_officers: number;
  cases_by_status: Record<string, number>;
  firs_by_status: Record<string, number>;
}

export const dashboardApi = {
  async getPoliceDashboard(): Promise<PoliceDashboardStats> {
    return await apiClient.get<PoliceDashboardStats>('/dashboard/police');
  },

  async getCitizenDashboard(): Promise<CitizenDashboardStats> {
    return await apiClient.get<CitizenDashboardStats>('/dashboard/citizen');
  },

  async getAdminDashboard(): Promise<AdminDashboardStats> {
    return await apiClient.get<AdminDashboardStats>('/dashboard/admin');
  },
};
