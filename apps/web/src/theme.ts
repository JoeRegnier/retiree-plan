import { createTheme, alpha } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6C63FF',
      light: '#918AFF',
      dark: '#4B45B2',
    },
    secondary: {
      main: '#00D9A6',
      light: '#33E0B8',
      dark: '#009874',
    },
    background: {
      default: '#0A0E1A',
      paper: '#111827',
    },
    error: {
      main: '#FF6B6B',
    },
    warning: {
      main: '#FFB84D',
    },
    success: {
      main: '#00D9A6',
    },
    info: {
      main: '#6C63FF',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: alpha('#94A3B8', 0.12),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem', letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, fontSize: '1.5rem' },
    h4: { fontWeight: 600, fontSize: '1.25rem' },
    h5: { fontWeight: 600, fontSize: '1.1rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    body1: { fontSize: '0.95rem', lineHeight: 1.6 },
    body2: { fontSize: '0.85rem', lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 20px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
          border: '1px solid',
          borderColor: alpha('#94A3B8', 0.08),
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});
