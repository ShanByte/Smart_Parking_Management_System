import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  ProtectedRoute,
  RoleGuard,
  GuardOnlyRoute,
  AdminOnlyRoute,
} from './guards';
import { useAuthStore } from '../stores/authStore';
import { User } from '../types/contract';

describe('Route Guards Redirection', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  const mockUser: User = {
    id: 'u-1',
    name: 'Normal User',
    email: 'user@example.com',
    role: 'USER',
  };

  const mockGuard: User = {
    id: 'g-1',
    name: 'Guard Officer',
    email: 'guard@example.com',
    role: 'GUARD',
    assignedLotId: 'lot-1',
  };

  const mockAdmin: User = {
    id: 'a-1',
    name: 'System Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  it('redirects unauthenticated user to /login when visiting ProtectedRoute', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Secret Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Secret Content')).not.toBeInTheDocument();
  });

  it('allows authenticated user through ProtectedRoute', () => {
    useAuthStore.getState().setAuth(mockUser, 'test-jwt-token');

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Secret Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Secret Content')).toBeInTheDocument();
  });

  it('redirects GUARD to /guard when accessing user-only route', () => {
    useAuthStore.getState().setAuth(mockGuard, 'guard-jwt-token');

    render(
      <MemoryRouter initialEntries={['/user-zone']}>
        <Routes>
          <Route path="/guard" element={<div>Guard Dashboard</div>} />
          <Route
            path="/user-zone"
            element={
              <RoleGuard allowedRoles={['USER']}>
                <div>Driver Area</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Guard Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Driver Area')).not.toBeInTheDocument();
  });

  it('redirects USER to / when accessing GuardOnlyRoute', () => {
    useAuthStore.getState().setAuth(mockUser, 'user-jwt-token');

    render(
      <MemoryRouter initialEntries={['/guard']}>
        <Routes>
          <Route path="/" element={<div>Home Map Page</div>} />
          <Route
            path="/guard"
            element={
              <GuardOnlyRoute>
                <div>Guard Live Console</div>
              </GuardOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home Map Page')).toBeInTheDocument();
    expect(screen.queryByText('Guard Live Console')).not.toBeInTheDocument();
  });

  it('allows GUARD to access GuardOnlyRoute', () => {
    useAuthStore.getState().setAuth(mockGuard, 'guard-jwt-token');

    render(
      <MemoryRouter initialEntries={['/guard']}>
        <Routes>
          <Route path="/" element={<div>Home Map Page</div>} />
          <Route
            path="/guard"
            element={
              <GuardOnlyRoute>
                <div>Guard Live Console</div>
              </GuardOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Guard Live Console')).toBeInTheDocument();
  });

  it('redirects USER to / when accessing AdminOnlyRoute', () => {
    useAuthStore.getState().setAuth(mockUser, 'user-jwt-token');

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/" element={<div>Home Map Page</div>} />
          <Route
            path="/admin"
            element={
              <AdminOnlyRoute>
                <div>Admin Secret Panel</div>
              </AdminOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home Map Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Secret Panel')).not.toBeInTheDocument();
  });

  it('allows ADMIN to access AdminOnlyRoute and GuardOnlyRoute', () => {
    useAuthStore.getState().setAuth(mockAdmin, 'admin-jwt-token');

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminOnlyRoute>
                <div>Admin Secret Panel</div>
              </AdminOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Secret Panel')).toBeInTheDocument();
  });
});
