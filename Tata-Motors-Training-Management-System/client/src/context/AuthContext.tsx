import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api/client';

interface AuthUser {
  id: number;
  username: string;
  role: string;
  fullName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSession: (user: AuthUser) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('tmtp_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      // The session token is now set by the server as an httpOnly cookie
      // (not readable by JavaScript), so only the non-sensitive user profile
      // is kept client-side for UI display.
      localStorage.setItem('tmtp_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem('tmtp_user');
    setUser(null);
  }, []);

  // Used after the admin changes their own username/password (Settings page)
  // so the app reflects the new credentials without requiring a fresh login.
  // The server issues a refreshed session cookie itself; the client only
  // needs to update the displayed user profile.
  const updateSession = useCallback((updatedUser: AuthUser) => {
    localStorage.setItem('tmtp_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateSession, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
