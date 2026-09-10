// ============================================================
// TRINETRA — In-App Notifications Service API
// ============================================================

import { apiClient } from './client';

export interface BackendNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type?: string | null;
  is_read: boolean;
  related_fir_id?: string | null;
  related_case_id?: string | null;
  created_at: string;
}

export const notificationsApi = {
  async list(params?: { page?: number; size?: number }): Promise<BackendNotification[]> {
    return await apiClient.get<BackendNotification[]>('/notifications', { params });
  },

  async markRead(id: string): Promise<boolean> {
    return await apiClient.patch<boolean>(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<number> {
    return await apiClient.post<number>('/notifications/read-all');
  },
};
