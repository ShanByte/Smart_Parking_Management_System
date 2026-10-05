import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center p-16 text-slate-400 text-sm">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
    Loading content...
  </div>
);

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
