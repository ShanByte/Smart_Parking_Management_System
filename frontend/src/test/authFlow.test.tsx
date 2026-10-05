import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Login } from '../pages/Login';
import { Signup } from '../pages/Signup';
import { useAuthStore } from '../stores/authStore';
import { tokenManager } from '../services/tokenManager';

describe('Auth Flow, Role Redirection & Session Management', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    tokenManager.clear();
  });

  describe('Login Form Validation & Role-based Home Redirection', () => {
    it('shows accessible field error when submitting invalid credentials', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      );

      const submitBtn = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Email address is required/i)).toBeInTheDocument();
        expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
      });

      // Verify accessible ARIA attributes
      const emailInput = screen.getByLabelText(/Email Address/i);
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
    });

    it('redirects USER to map home (/) upon login', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div>Map Home Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      const driverBtn = screen.getByRole('button', { name: /driver \(map\)/i });
      fireEvent.click(driverBtn);

      await waitFor(() => {
        expect(screen.getByText('Map Home Screen')).toBeInTheDocument();
      });

      expect(useAuthStore.getState().role).toBe('USER');
      expect(tokenManager.getAccessToken()).toBeTruthy();
    });

    it('redirects GUARD to guard console (/guard) upon login', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/guard" element={<div>Guard Live Console Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      const guardBtn = screen.getByRole('button', { name: /guard \(\/guard\)/i });
      fireEvent.click(guardBtn);

      await waitFor(() => {
        expect(screen.getByText('Guard Live Console Screen')).toBeInTheDocument();
      });

      expect(useAuthStore.getState().role).toBe('GUARD');
      expect(tokenManager.getAccessToken()).toBeTruthy();
    });

    it('redirects ADMIN to admin dashboard (/admin) upon login', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<div>Admin Management Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      const adminBtn = screen.getByRole('button', { name: /admin \(\/admin\)/i });
      fireEvent.click(adminBtn);

      await waitFor(() => {
        expect(screen.getByText('Admin Management Screen')).toBeInTheDocument();
      });

      expect(useAuthStore.getState().role).toBe('ADMIN');
      expect(tokenManager.getAccessToken()).toBeTruthy();
    });
  });

  describe('Signup Form Validation', () => {
    it('validates required fields with accessible feedback', async () => {
      render(
        <MemoryRouter initialEntries={['/signup']}>
          <Signup />
        </MemoryRouter>
      );

      const registerBtn = screen.getByRole('button', { name: /register/i });
      fireEvent.click(registerBtn);

      await waitFor(() => {
        expect(screen.getByText(/Full name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/Email address is required/i)).toBeInTheDocument();
        expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
      });
    });

    it('submits valid registration successfully', async () => {
      render(
        <MemoryRouter initialEntries={['/signup']}>
          <Signup />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full Name/i), {
        target: { value: 'Rohan Sharma' },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'rohan@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
        target: { value: 'securePass123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/Account created successfully/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Session Restore on Load & Token Security', () => {
    it('restores user session on load using refresh token', async () => {
      const restored = await useAuthStore.getState().restoreSession();
      expect(restored).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.role).toBe('USER');

      // Verify Security Rule 2 & 6: Access token strictly in memory
      const inMemoryToken = tokenManager.getAccessToken();
      expect(inMemoryToken).toBe('mock_refreshed_jwt_token');
    });

    it('clears state and in-memory token on logout', async () => {
      // First restore session
      await useAuthStore.getState().restoreSession();
      expect(tokenManager.getAccessToken()).toBeTruthy();

      // Now logout
      await useAuthStore.getState().logout();
      expect(tokenManager.getAccessToken()).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
