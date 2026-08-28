import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, type SessionUser } from '../lib/api';
import { closeSocket } from '../lib/socket';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  googleEnabled: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  /** Re-reads the session; call after setup or a profile change. */
  refresh: () => Promise<void>;
  setUser: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface MeResponse {
  user: SessionUser | null;
  needsSetup?: boolean;
  googleEnabled: boolean;
}

interface AuthResponse {
  user: SessionUser;
  needsSetup: boolean;
  suggestedUsername?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    googleEnabled: false,
  });

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<MeResponse>('/api/auth/me');
      setState({ user: data.user, loading: false, googleEnabled: data.googleEnabled });
    } catch {
      // A failed session lookup means signed out, not a broken app.
      setState((prev) => ({ ...prev, user: null, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<AuthResponse>('/api/auth/login', { email, password });
    setState((prev) => ({ ...prev, user: data.user, loading: false }));
    return data.user;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const data = await api.post<AuthResponse>('/api/auth/register', { email, password });
    setState((prev) => ({ ...prev, user: data.user, loading: false }));
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // Already signed out is fine; anything else still clears local state.
      if (!(error instanceof ApiError)) throw error;
    }
    closeSocket();
    setState((prev) => ({ ...prev, user: null }));
  }, []);

  const setUser = useCallback((user: SessionUser) => {
    setState((prev) => ({ ...prev, user }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, refresh, setUser }),
    [state, login, register, logout, refresh, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
