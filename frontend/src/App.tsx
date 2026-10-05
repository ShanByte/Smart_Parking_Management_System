import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppRouter } from './router';
import { useAuthStore } from './stores/authStore';

const AppContent: React.FC = () => {
  const restoreSession = useAuthStore((state) => state.restoreSession);

  // Restore user session on application load (C5 / Security Rule 2)
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return <AppRouter />;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
