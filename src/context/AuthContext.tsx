import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { loginRequest } from '../api/authApi';
import { authStorage } from '../lib/authStorage';
import { resetIntroGate } from '../lib/introGate';
import type { LoginPayload } from '../types/auth';
import { AuthContext, type AuthContextValue } from './authStore';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const [user, setUser] = useState(() => authStorage.getUser());

  const login = useCallback(async (payload: LoginPayload) => {
    const session = await loginRequest(payload);
    authStorage.setSession(session);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    resetIntroGate();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isBootstrapping: false,
      login,
      logout,
    }),
    [login, logout, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
