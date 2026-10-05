import { create } from 'zustand';
import { User, Role } from '../types/contract';
import { tokenManager } from '../services/tokenManager';

interface AuthState {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: false,

  setAuth: (user: User, token: string) => {
    tokenManager.setAccessToken(token);
    set({
      user,
      role: user.role,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  clearAuth: () => {
    tokenManager.clear();
    set({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
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
}));
