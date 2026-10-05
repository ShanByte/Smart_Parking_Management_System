import { create } from 'zustand';
import { User, Role, RefreshResponseData } from '../types/contract';
import { tokenManager } from '../services/tokenManager';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  restoreSession: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: true, // Start in loading state until session is restored on load
  isInitialized: false,

  setAuth: (user: User, token: string) => {
    tokenManager.setAccessToken(token);
    set({
      user,
      role: user.role,
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });
  },

  clearAuth: () => {
    tokenManager.clear();
    set({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
    });
  },

  setUser: (user: User | null) => {
    set({
      user,
      role: user?.role ?? null,
      isAuthenticated: !!user,
    });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  /**
   * Session Restore on Load
   * Calls POST /auth/refresh with httpOnly cookie to silently restore user session
   */
  restoreSession: async (): Promise<boolean> => {
    // If already authenticated in memory, skip
    if (get().isAuthenticated && tokenManager.getAccessToken()) {
      set({ isLoading: false, isInitialized: true });
      return true;
    }

    set({ isLoading: true });

    try {
      const res = await api.post<{ success: boolean; data: RefreshResponseData }>(
        '/auth/refresh',
        {},
        {
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
        }
      );

      const { accessToken, user } = res.data.data;
      if (accessToken) {
        tokenManager.setAccessToken(accessToken);

        // If user object returned with refresh
        if (user) {
          set({
            user,
            role: user.role,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
          return true;
        }

        // If refresh only returned token, fetch current user info via GET /auth/me
        try {
          const meRes = await api.get<{ success: boolean; data: { user: User } }>('/auth/me');
          const fetchedUser = meRes.data.data.user;
          set({
            user: fetchedUser,
            role: fetchedUser.role,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
          return true;
        } catch {
          // Token exists but /auth/me failed
          tokenManager.clear();
        }
      }

      set({
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });
      return false;
    } catch {
      // Unauthenticated (no valid refresh cookie)
      tokenManager.clear();
      set({
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });
      return false;
    }
  },

  /**
   * User Logout
   */
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout', {}, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      get().clearAuth();
    }
  },
}));
