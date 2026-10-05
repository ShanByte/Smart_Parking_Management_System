import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { Button } from '../components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { LogIn, User, Shield, LayoutDashboard } from 'lucide-react';
import { AuthResponseData } from '../types/contract';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleLoginSubmit = async (loginEmail: string, loginPass: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ success: boolean; data: AuthResponseData }>('/auth/login', {
        email: loginEmail,
        password: loginPass,
      });

      const { accessToken, user } = res.data.data;
      setAuth(user, accessToken);

      // Route according to role
      if (user.role === 'GUARD') {
        navigate('/guard');
      } else if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate(from === '/login' ? '/' : from);
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Login failed. Please check your credentials.';
      setError(message);
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
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
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
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
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
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5"
              isLoading={loading}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Logins for Team Evaluation */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 text-center mb-2.5">
              Quick Demo Logins (C2 Roles):
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs py-1.5"
                onClick={() => handleLoginSubmit('driver@example.com', 'password123')}
              >
                <User className="w-3.5 h-3.5 mr-1" />
                Driver
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs py-1.5"
                onClick={() => handleLoginSubmit('guard@example.com', 'password123')}
              >
                <Shield className="w-3.5 h-3.5 mr-1" />
                Guard
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs py-1.5"
                onClick={() => handleLoginSubmit('admin@example.com', 'password123')}
              >
                <LayoutDashboard className="w-3.5 h-3.5 mr-1" />
                Admin
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
