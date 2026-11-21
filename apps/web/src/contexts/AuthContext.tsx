import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  mfaEnabled?: boolean;
}

interface MfaChallenge {
  mfaToken: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  mfaChallenge: MfaChallenge | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  verifyMfaLogin: (verificationCode: string) => Promise<void>;
  cancelMfaLogin: () => void;
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
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);

  const applyAuthSuccess = useCallback((data: { user: AuthUser; accessToken: string }) => {
    setUser(data.user);
    setToken(data.accessToken);
    setMfaChallenge(null);
    safeSetItem('rp_user', JSON.stringify(data.user));
    safeSetItem('rp_token', data.accessToken);
  }, []);

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
    if (data.requiresMfa) {
      if (typeof data.mfaToken !== 'string') {
        throw new Error('MFA challenge is invalid');
      }
      setMfaChallenge({ mfaToken: data.mfaToken, email });
      return;
    }
    applyAuthSuccess(data);
  }, [applyAuthSuccess]);

  const verifyMfaLogin = useCallback(async (verificationCode: string) => {
    if (!mfaChallenge) {
      throw new Error('No MFA login challenge is active');
    }
    const res = await fetch('/api/auth/mfa/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken: mfaChallenge.mfaToken, verificationCode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Verification failed' }));
      throw new Error(err.message || 'Verification failed');
    }
    const data = await res.json();
    applyAuthSuccess(data);
  }, [applyAuthSuccess, mfaChallenge]);

  const cancelMfaLogin = useCallback(() => {
    setMfaChallenge(null);
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
    applyAuthSuccess(data);
  }, [applyAuthSuccess]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setMfaChallenge(null);
    safeRemoveItem('rp_user');
    safeRemoveItem('rp_token');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        mfaChallenge,
        isAuthenticated: !!token,
        login,
        verifyMfaLogin,
        cancelMfaLogin,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
