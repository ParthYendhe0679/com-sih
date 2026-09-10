// ============================================================
// TRINETRA — Authentication Service API
// ============================================================

import { apiClient } from './client';

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  role: 'CITIZEN' | 'POLICE' | 'ADMIN';
  username: string;
  badge_number?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  phone_number?: string;
  role: 'CITIZEN' | 'POLICE' | 'ADMIN';
  badge_number?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export const authApi = {
  async login(username_or_email: string, password: string): Promise<LoginResponse> {
    const data = await apiClient.post<LoginResponse>('/auth/login', {
      username_or_email,
      password,
    }, { skipAuth: true });

    if (typeof window !== 'undefined' && data?.access_token) {
      localStorage.setItem('TRINETRA_token', data.access_token);
      localStorage.setItem('TRINETRA_user', JSON.stringify(data));
      localStorage.setItem('TRINETRA_role', data.role.toLowerCase());
    }

    return data;
  },

  async register(payload: {
    email: string;
    username: string;
    full_name: string;
    password: string;
    phone_number?: string;
  }): Promise<UserProfile> {
    return await apiClient.post<UserProfile>('/auth/register', payload, { skipAuth: true });
  },

  async getMe(): Promise<UserProfile> {
    return await apiClient.get<UserProfile>('/auth/me');
  },

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('TRINETRA_token');
      localStorage.removeItem('TRINETRA_user');
      localStorage.removeItem('TRINETRA_role');
    }
  },

  getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('TRINETRA_token');
  },

  getStoredUser(): LoginResponse | null {
    if (typeof window === 'undefined') return null;
    const str = localStorage.getItem('TRINETRA_user');
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  },
};
