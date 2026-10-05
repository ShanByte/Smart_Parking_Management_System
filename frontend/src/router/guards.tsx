import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Role } from '../types/contract';
import { getRoleHomePath } from '../utils/roles';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

/**
 * Base ProtectedRoute: ensures user is authenticated.
 * If not authenticated, redirects to /login with state to preserve target location.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore();
  const location = useLocation();

  if (isLoading && !isInitialized) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center p-12 text-slate-500 text-sm"
      >
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-2.5" />
        Restoring session...
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
 * Redirects unauthorized roles directly to their respective home screen.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, isLoading, isInitialized } = useAuthStore();
  const location = useLocation();

  if (isLoading && !isInitialized) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center p-12 text-slate-500 text-sm"
      >
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-2.5" />
        Verifying role authorization...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Send role to its home path
    const homePath = getRoleHomePath(user.role);
    return <Navigate to={homePath} replace />;
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
