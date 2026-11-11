'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface AuthUser {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  fullName: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  roles: string[];
  permissions: string[];
  passkeyCount: number;
  sessionId?: string;
}

interface LoginResponse {
  mfaRequired?: boolean;
  challengeToken?: string;
  user?: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResponse>;
  verifyMfa: (challengeToken: string, code: string) => Promise<LoginResponse>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await apiFetch<AuthUser>('/auth/me', {}, true);
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, clientType: 'web' }),
    });
    if (!res.mfaRequired && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const verifyMfa = async (challengeToken: string, code: string): Promise<LoginResponse> => {
    const res = await apiFetch<LoginResponse>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code, clientType: 'web' }),
    });
    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const register = async (fullName: string, email: string, password: string) => {
    const res = await apiFetch<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password, clientType: 'web' }),
    });
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' }, false);
    } finally {
      setUser(null);
    }
  };

  const hasPermission = (perm: string) => Boolean(user?.permissions.includes(perm));
  const hasAnyRole = (roles: string[]) =>
    Boolean(user?.roles.some((r) => roles.includes(r)));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        login,
        verifyMfa,
        register,
        logout,
        hasPermission,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
