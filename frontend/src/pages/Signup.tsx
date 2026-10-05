import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Button } from '../components/common/Button';
import { Card, CardContent } from '../components/common/Card';
import {
  CarIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  MapPinIcon,
} from '../components/common/icons';
import { registerSchema } from '../schemas/authSchemas';

export const Signup: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    // 1. Zod Validation with Shared Schema
    const validation = registerSchema.safeParse({
      name,
      email,
      password,
    });

    if (!validation.success) {
      const formatted = validation.error.format();
      setFieldErrors({
        name: formatted.name?._errors[0],
        email: formatted.email?._errors[0],
        password: formatted.password?._errors[0],
      });
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', {
        name: validation.data.name,
        email: validation.data.email,
        password: validation.data.password,
      });

      setSuccessMessage('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Registration failed. An account with this email may already exist.';
      setGeneralError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 sm:py-12 px-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        {/* Desktop Brand Showcase Panel (hidden on mobile) */}
        <div className="hidden md:flex md:col-span-5 flex-col justify-between bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
                <CarIcon className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <span className="font-black text-lg tracking-tight">SmartParking</span>
                <span className="block text-xs text-indigo-300 font-medium">Pune Live Network</span>
              </div>
            </div>

            <div className="pt-6 space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white leading-snug">
                Join Pune's smartest parking network.
              </h2>
              <p className="text-sm text-indigo-200 leading-relaxed">
                Create your account in seconds and say goodbye to endless circling for spots.
              </p>
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckIcon className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-slate-200">
                  <strong className="text-white block font-semibold">Reserve Before Leaving</strong>
                  View live spot occupancy across Pune and reserve in advance.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-400/20 text-indigo-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPinIcon className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-slate-200">
                  <strong className="text-white block font-semibold">One-Tap Navigation</strong>
                  Instant turn-by-turn navigation straight to your assigned parking bay.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-400/20 text-blue-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-slate-200">
                  <strong className="text-white block font-semibold">Zero Paperwork</strong>
                  Clean digital receipts, automatic timer warnings, and guard passes.
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10 text-[11px] text-indigo-300 flex items-center justify-between">
            <span>Free Registration</span>
            <span className="font-mono">Team CodeCrafters</span>
          </div>
        </div>

        {/* Form Panel */}
        <div className="md:col-span-7 flex flex-col justify-center">
          <Card className="shadow-lg border-slate-200 rounded-3xl p-2 sm:p-4">
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Create an Account
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Join SmartParking to easily find, reserve and navigate to slots
                </p>
              </div>

              {generalError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shadow-sm"
                >
                  <AlertCircleIcon className="w-5 h-5 flex-shrink-0 text-red-600" />
                  <span>{generalError}</span>
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  className="p-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 shadow-sm"
                >
                  <CheckCircleIcon className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                  <span>{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    required
                    aria-required="true"
                    aria-invalid={fieldErrors.name ? 'true' : 'false'}
                    aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) {
                        setFieldErrors((prev) => ({ ...prev, name: undefined }));
                      }
                    }}
                    placeholder="Rohan Sharma"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                      fieldErrors.name
                        ? 'border-red-400 focus:ring-red-500 bg-red-50/20'
                        : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-500'
                    }`}
                  />
                  {fieldErrors.name && (
                    <p id="name-error" role="alert" className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                      <AlertCircleIcon className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    aria-required="true"
                    aria-invalid={fieldErrors.email ? 'true' : 'false'}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    placeholder="rohan@example.com"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                      fieldErrors.email
                        ? 'border-red-400 focus:ring-red-500 bg-red-50/20'
                        : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-500'
                    }`}
                  />
                  {fieldErrors.email && (
                    <p id="email-error" role="alert" className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                      <AlertCircleIcon className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="password"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                    >
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      aria-required="true"
                      aria-invalid={fieldErrors.password ? 'true' : 'false'}
                      aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      placeholder="At least 8 characters"
                      className={`w-full pl-4 pr-11 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
                        fieldErrors.password
                          ? 'border-red-400 focus:ring-red-500 bg-red-50/20'
                          : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                      aria-label={showPassword ? 'Hide value' : 'Show value'}
                    >
                      {showPassword ? (
                        <EyeOffIcon className="w-4 h-4" />
                      ) : (
                        <EyeIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="password-error" role="alert" className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                      <AlertCircleIcon className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-3 font-bold text-sm shadow-md mt-2"
                  isLoading={loading}
                >
                  Register
                </Button>
              </form>

              <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                Already have an account?{' '}
                <Link to="/login" className="text-indigo-600 font-bold hover:underline">
                  Sign In
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Signup;
