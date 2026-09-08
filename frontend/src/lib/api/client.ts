// ============================================================
// KRITAGAS — Central API Client
// ============================================================

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  error?: {
    code: string;
    details: any;
  } | null;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

export class ApiError extends Error {
  code?: string;
  status: number;
  details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    let token = localStorage.getItem('kritagas_token');
    if (!token) {
      const role = localStorage.getItem('kritagas_role') || 'police';
      token = `demo-token-${role}-session`;
      try {
        localStorage.setItem('kritagas_token', token);
      } catch (_) {}
    }
    return token;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          url.searchParams.append(key, String(val));
        }
      });
    }

    return url.toString();
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { params, skipAuth = false, headers = {}, ...rest } = options;
    const url = this.buildUrl(path, params);

    const reqHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...((headers as Record<string, string>) || {}),
    };

    if (!skipAuth) {
      const token = this.getToken();
      if (token) {
        reqHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    // Default to JSON content type if sending body and not FormData
    if (rest.body && !(rest.body instanceof FormData) && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...rest,
        headers: reqHeaders,
      });

      const json: ApiResponse<T> = await response.json().catch(() => ({
        success: response.ok,
        message: response.statusText,
        data: null as any,
        error: { code: 'INVALID_JSON', details: {} },
      }));

      if (!response.ok || json.success === false) {
        throw new ApiError(
          json.message || `Request failed with status ${response.status}`,
          response.status,
          json.error?.code,
          json.error?.details
        );
      }

      return json;
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      // Network or CORS failure
      throw new ApiError(
        err.message || 'Network connection to KRITAGAS backend failed.',
        0,
        'NETWORK_ERROR',
        err
      );
    }
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const res = await this.request<T>(path, { ...options, method: 'GET' });
    return res.data;
  }

  async post<T>(path: string, body?: any, options: RequestOptions = {}): Promise<T> {
    const serialized = body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined;
    const res = await this.request<T>(path, {
      ...options,
      method: 'POST',
      body: serialized,
    });
    return res.data;
  }

  async patch<T>(path: string, body?: any, options: RequestOptions = {}): Promise<T> {
    const serialized = body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined;
    const res = await this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: serialized,
    });
    return res.data;
  }

  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const res = await this.request<T>(path, { ...options, method: 'DELETE' });
    return res.data;
  }

  async upload<T>(path: string, formData: FormData, options: RequestOptions = {}): Promise<T> {
    const res = await this.request<T>(path, {
      ...options,
      method: 'POST',
      body: formData,
    });
    return res.data;
  }
}

export const apiClient = new ApiClient(BASE_URL);
