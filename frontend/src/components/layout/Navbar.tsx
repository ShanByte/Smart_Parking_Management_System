import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { Button } from '../common/Button';
import {
  CarIcon,
  MapPinIcon,
  CalendarIcon,
  UserIcon,
  ShieldIcon,
  DashboardIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from '../common/icons';

export const Navbar: React.FC = () => {
  const { user, role, isAuthenticated, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network failure on logout
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { label: 'Map', path: '/', icon: MapPinIcon },
    ...(isAuthenticated ? [{ label: 'My Bookings', path: '/bookings', icon: CalendarIcon }] : []),
    ...(isAuthenticated ? [{ label: 'Profile', path: '/profile', icon: UserIcon }] : []),
    ...(role === 'GUARD' ? [{ label: 'Guard Console', path: '/guard', icon: ShieldIcon }] : []),
    ...(role === 'ADMIN' ? [{ label: 'Admin Dashboard', path: '/admin', icon: DashboardIcon }] : []),
  ];

  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 font-bold text-lg text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600 rounded-lg p-1 -ml-1 select-none"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <CarIcon className="w-5 h-5 text-white" />
            </div>
            <span className="tracking-tight text-slate-900">
              Smart<span className="text-indigo-600">Parking</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium min-h-[40px] motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-600 ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action / Auth Controls */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end text-xs">
                  <span className="font-semibold text-slate-800">{user.name}</span>
                  <span className="text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider">
                    {user.role}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-1.5 text-slate-600 hover:text-slate-900 border-slate-300"
                >
                  <LogoutIcon className="w-3.5 h-3.5" />
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" tabIndex={-1}>
                  <Button variant="ghost" size="sm">
                    Log In
                  </Button>
                </Link>
                <Link to="/signup" tabIndex={-1}>
                  <Button variant="primary" size="sm">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation panel */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-1.5 shadow-md"
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium min-h-[44px] motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {link.label}
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-100 mt-2">
            {isAuthenticated && user ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout} className="min-h-[44px]">
                  Logout
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full min-h-[44px]">
                    Log In
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="sm" className="w-full min-h-[44px]">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
