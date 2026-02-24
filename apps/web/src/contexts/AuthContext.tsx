import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function safeGetItem(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveItem(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = safeGetItem('rp_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => safeGetItem('rp_token'));

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.accessToken);
    safeSetItem('rp_user', JSON.stringify(data.user));
    safeSetItem('rp_token', data.accessToken);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Registration failed');
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.accessToken);
    safeSetItem('rp_user', JSON.stringify(data.user));
    safeSetItem('rp_token', data.accessToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    safeRemoveItem('rp_user');
    safeRemoveItem('rp_token');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
