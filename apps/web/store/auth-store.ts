'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { BASE_AUTH_USERS } from '@/lib/auth-config';
import { clearAuthCookies, setAuthCookies } from '@/lib/auth-cookies';
import type { AuthLoginInput, AuthLoginResult, AuthUser } from '@/types/auth';

type AuthState = {
  user: AuthUser | null;
  hydrated: boolean;
  login: (credentials: AuthLoginInput) => AuthLoginResult;
  logout: () => void;
  markHydrated: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      login: ({ username, password }) => {
        const normalizedUsername = username.trim().toLowerCase();
        const match = BASE_AUTH_USERS.find(
          (candidate) =>
            candidate.username.toLowerCase() === normalizedUsername && candidate.password === password,
        );

        if (!match) {
          return {
            ok: false,
            message: 'Credenciales invalidas.',
          };
        }

        const user: AuthUser = {
          username: match.username,
          displayName: match.displayName,
          role: match.role,
        };

        set({ user });
        setAuthCookies(user.role);

        return { ok: true };
      },
      logout: () => {
        clearAuthCookies();
        set({ user: null });
      },
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'fluxcy-auth-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
