import { useAuth } from '../contexts/AuthContext';

const API_BASE = '/api';

export function useApi() {
  const { token, logout } = useAuth();

  const apiFetch = async <T = unknown>(path: string, options: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (res.status === 401) {
      logout();
      throw new Error('Session expired. Please log in again.');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${res.status}`);
    }

    // 204 No Content (and 205) have no body — return null rather than trying to parse JSON
    if (res.status === 204 || res.status === 205) {
      return null as unknown as T;
    }

    return res.json();
  };

  return { apiFetch };
}
