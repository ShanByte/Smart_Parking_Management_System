import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { Button } from '../components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { LogIn, User, Shield, LayoutDashboard, AlertCircle } from 'lucide-react';
import { AuthResponseData } from '../types/contract';
import { loginSchema } from '../schemas/authSchemas';
import { getRoleHomePath } from '../utils/roles';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLoginSubmit = async (loginEmail: string, loginPass: string) => {
    // 1. Zod Validation with Shared Schema
    setGeneralError(null);
    setFieldErrors({});

    const validation = loginSchema.safeParse({
      email: loginEmail,
      password: loginPass,
    });

    if (!validation.success) {
      const formatted = validation.error.format();
      setFieldErrors({
        email: formatted.email?._errors[0],
        password: formatted.password?._errors[0],
      });
      return;
    }

    setLoading(true);

    try {
      const res = await api.post<{ success: boolean; data: AuthResponseData }>('/auth/login', {
        email: validation.data.email,
        password: validation.data.password,
      });

      const { accessToken, user } = res.data.data;
      setAuth(user, accessToken);

      // Check if user came from a protected route
      const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname;

      if (fromPath && fromPath !== '/login' && fromPath !== '/signup') {
        // If from path belongs to another role, enforce home path
        if (fromPath.startsWith('/guard') && user.role !== 'GUARD' && user.role !== 'ADMIN') {
          navigate(getRoleHomePath(user.role));
          return;
        }
        if (fromPath.startsWith('/admin') && user.role !== 'ADMIN') {
          navigate(getRoleHomePath(user.role));
          return;
        }
        navigate(fromPath);
      } else {
        // Direct home path: USER -> '/', GUARD -> '/guard', ADMIN -> '/admin'
        navigate(getRoleHomePath(user.role));
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Login failed. Invalid email or password.';
      setGeneralError(message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLoginSubmit(email, password);
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Log in to manage your parking bookings and live lots
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {generalError && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                aria-required="true"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                placeholder="name@example.com"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 ${
                  fieldErrors.email
                    ? 'border-red-400 focus:ring-red-500 bg-red-50/20'
                    : 'border-slate-300 focus:ring-indigo-500'
                }`}
              />
              {fieldErrors.email && (
                <p id="email-error" role="alert" className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                aria-required="true"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                placeholder="••••••••"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 ${
                  fieldErrors.password
                    ? 'border-red-400 focus:ring-red-500 bg-red-50/20'
                    : 'border-slate-300 focus:ring-indigo-500'
                }`}
              />
              {fieldErrors.password && (
                <p id="password-error" role="alert" className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 font-semibold"
              isLoading={loading}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Logins for Team Evaluation */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 text-center mb-2.5">
              Quick Role-Based Demo Logins:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs py-1.5"
                onClick={() => {
                  setEmail('driver@example.com');
                  setPassword('password123');
                  handleLoginSubmit('driver@example.com', 'password123');
                }}
              >
                <User className="w-3.5 h-3.5 mr-1" />
                Driver (Map)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs py-1.5"
                onClick={() => {
                  setEmail('guard@example.com');
                  setPassword('password123');
                  handleLoginSubmit('guard@example.com', 'password123');
                }}
              >
                <Shield className="w-3.5 h-3.5 mr-1" />
                Guard (/guard)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs py-1.5"
                onClick={() => {
                  setEmail('admin@example.com');
                  setPassword('password123');
                  handleLoginSubmit('admin@example.com', 'password123');
                }}
              >
                <LayoutDashboard className="w-3.5 h-3.5 mr-1" />
                Admin (/admin)
              </Button>
            </div>
          </div>

          <div className="text-center text-xs text-slate-500 pt-2">
            Don't have an account?{' '}
            <Link to="/signup" className="text-indigo-600 font-semibold hover:underline">
              Create an account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
