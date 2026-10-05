import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { z } from 'zod';
import { tokenManager } from './tokenManager';
import { useAuthStore } from '../stores/authStore';
import { handleMockRequest } from '../mocks/mockApi';

// Determine base URL from environment or fallback
const API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  'http://localhost:4000/api/v1';

const USE_MOCKS =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_USE_MOCKS === 'true';

/**
 * Authoritative API client (C9)
 * Named export `api`
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Response validation helper using Zod
 * Validates payload against expected schema and returns typed data or throws.
 */
export function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`API response validation failed: ${errorDetails}`);
  }
  return result.data;
}

// Request Interceptor: headers, auth token, and mock handling
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 1. In-memory access token handling (C5, Rule 6)
    const token = tokenManager.getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Required header on /auth/refresh and /auth/logout (C5)
    const url = config.url || '';
    if (url.includes('/auth/refresh') || url.includes('/auth/logout')) {
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    // 3. Mock data interception when VITE_USE_MOCKS=true
    if (USE_MOCKS) {
      const mockResult = handleMockRequest(
        config.method || 'GET',
        config.url || '',
        config.data,
        config.headers as unknown as Record<string, string>
      );

      if (mockResult) {
        // Return synthetic Axios adapter response
        config.adapter = () => {
          return new Promise((resolve, reject) => {
            if (mockResult.status >= 200 && mockResult.status < 300) {
              resolve({
                data: mockResult.data,
                status: mockResult.status,
                statusText: 'OK',
                headers: {},
                config,
              });
            } else {
              reject({
                response: {
                  data: mockResult.data,
                  status: mockResult.status,
                  statusText: 'Error',
                  headers: {},
                  config,
                },
                config,
                isAxiosError: true,
              });
            }
          });
        };
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Single-flight refresh state (C9)
let refreshPromise: Promise<string | null> | null = null;

async function executeTokenRefresh(): Promise<string | null> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      {},
      {
        withCredentials: true,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );

    const newToken = res.data?.data?.accessToken;
    if (newToken) {
      tokenManager.setAccessToken(newToken);
      if (res.data?.data?.user) {
        useAuthStore.getState().setUser(res.data.data.user);
      }
      return newToken;
    }

    tokenManager.clear();
    useAuthStore.getState().clearAuth();
    return null;
  } catch (error) {
    tokenManager.clear();
    useAuthStore.getState().clearAuth();
    throw error;
  } finally {
    refreshPromise = null;
  }
}

// Response Interceptor: 401 single-flight refresh
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/register');

    // Handle 401 Unauthorized with single-flight refresh
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = executeTokenRefresh();
        }

        const newToken = await refreshPromise;
        if (newToken) {
          if (!originalRequest.headers) {
            originalRequest.headers = {};
          }
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest as InternalAxiosRequestConfig);
        }
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);
