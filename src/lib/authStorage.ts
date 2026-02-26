import type { AuthSession, User } from '../types/auth';

const TOKEN_KEY = 'fluxcy_dashboard_token';
const USER_KEY = 'fluxcy_dashboard_user';

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): User | null {
    const value = localStorage.getItem(USER_KEY);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as User;
    } catch {
      return null;
    }
  },

  setSession(session: AuthSession): void {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  },

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
