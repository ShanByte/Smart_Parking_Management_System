import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { useAuthStore } from '../stores/authStore';

describe('App Shell Rendering', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    window.history.pushState({}, 'Test', '/');
  });

  it('renders the application shell with branding and navigation', async () => {
    render(<App />);

    // Brand and logo are present
    expect(screen.getByText(/^Smart$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Parking$/i)).toBeInTheDocument();

    // Navigation links are visible
    expect(screen.getByRole('link', { name: /map/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();

    // Main content lazy loaded heading
    await waitFor(
      () => {
        expect(screen.getByText(/Find Parking in Pune/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
