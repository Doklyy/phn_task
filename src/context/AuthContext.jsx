import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth.js';
import { normalizeUser } from '../api/auth.js';

const AuthContext = createContext(null);

const ROLES = { ADMIN: 'admin', LEADER: 'leader', STAFF: 'staff' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!authApi.hasStoredToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch (_) {
      authApi.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    // BE trả về trực tiếp { userId, username, name, role, token }
    const u = data.user ?? data;
    setUser(normalizeUser(u) ?? {
      id: String(data.userId ?? u?.userId ?? ''),
      name: data.name ?? u?.name,
      role: (data.role ?? u?.role ?? '').toLowerCase(),
      username: data.username ?? u?.username,
      team: data.team ?? u?.team ?? null,
    });
    return data;
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  const canAssignTask = user && (user.role === ROLES.ADMIN || user.role === ROLES.LEADER);

  const value = {
    user,
    setUser,
    login,
    logout,
    loadUser,
    loading,
    canAssignTask,
    ROLES,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
