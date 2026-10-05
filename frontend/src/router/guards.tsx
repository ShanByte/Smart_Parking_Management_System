import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Role } from '../types/contract';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

/**
 * Base ProtectedRoute: ensures user is authenticated.
 * If not authenticated, redirects to /login with state to preserve target location.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

interface RoleGuardProps {
  children: React.ReactElement;
  allowedRoles: Role[];
}

/**
 * RoleGuard: checks both authentication and role authorization.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        Verifying permissions...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Role-based redirection:
    // If a GUARD lands on user routes, redirect to /guard
    if (user.role === 'GUARD') {
      return <Navigate to="/guard" replace />;
    }
    // If a USER lands on guard/admin routes, redirect to home
    return <Navigate to="/" replace />;
  }

  return children;
};

/** Role-specific guard helpers */
export const GuardOnlyRoute: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => <RoleGuard allowedRoles={['GUARD', 'ADMIN']}>{children}</RoleGuard>;

export const AdminOnlyRoute: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => <RoleGuard allowedRoles={['ADMIN']}>{children}</RoleGuard>;

export const UserOnlyRoute: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => <RoleGuard allowedRoles={['USER', 'ADMIN']}>{children}</RoleGuard>;
