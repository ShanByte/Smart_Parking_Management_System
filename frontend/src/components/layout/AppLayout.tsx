import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { SpinnerIcon } from '../common/icons';

export const PageLoader: React.FC = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex flex-col items-center justify-center p-16 text-slate-500 text-sm gap-3"
  >
    <SpinnerIcon className="w-8 h-8 text-indigo-600" />
    <span className="font-medium text-slate-600">Loading page...</span>
  </div>
);

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Skip to Main Content Link for Keyboard and Screen Reader Users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-indigo-600 focus:text-white focus:font-semibold focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 motion-safe:transition-transform"
      >
        Skip to content
      </a>

      <Navbar />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 outline-none"
      >
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Smart Parking Management System &copy; 2026 CodeCrafters</span>
          <span className="text-slate-400">
            Craftverse Hackathon Demo Edition &bull; Pune
          </span>
        </div>
      </footer>
    </div>
  );
};
