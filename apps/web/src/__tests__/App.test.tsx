import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material';
import { theme } from '../theme';
import { AuthProvider } from '../contexts/AuthContext';
import { App } from '../App';

function renderApp(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('shows login page when not authenticated', () => {
    renderApp('/');
    expect(screen.getByText('RetireePlan')).toBeInTheDocument();
    // MUI Tabs renders "Sign In" as a button role
    expect(screen.getByRole('tab', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows register tab on login page', () => {
    renderApp('/login');
    expect(screen.getByRole('tab', { name: /register/i })).toBeInTheDocument();
  });
});
