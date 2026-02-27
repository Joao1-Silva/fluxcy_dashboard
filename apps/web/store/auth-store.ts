'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthLoginInput, AuthLoginResult, AuthUser } from '@/types/auth';
import {
  getApiProfileOverrideFromBrowser,
  setApiProfileOverrideInBrowser,
} from '@/lib/api-profile';

type AuthState = {
  user: AuthUser | null;
  hydrated: boolean;
  login: (credentials: AuthLoginInput) => Promise<AuthLoginResult>;
  logout: () => Promise<void>;
  clearLocalUser: () => void;
  markHydrated: () => void;
};

type LoginSuccessPayload = {
  ok: true;
  user: AuthUser;
};

type LoginErrorPayload = {
  message?: string;
  expired?: boolean;
};

function isAuthRole(value: unknown): value is AuthUser['role'] {
  return value === 'superadmin' || value === 'supervisor' || value === 'welltech';
}

function asAuthUser(value: unknown): AuthUser | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.username !== 'string' ||
    typeof candidate.displayName !== 'string' ||
    !isAuthRole(candidate.role)
  ) {
    return null;
  }

  return {
    username: candidate.username,
    displayName: candidate.displayName,
    role: candidate.role,
    apiProfile: candidate.apiProfile === 'WELLTECH' ? 'WELLTECH' : 'DEFAULT',
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      login: async ({ username, password }) => {
        let response: Response;
        try {
          response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: username.trim(),
              password,
            }),
          });
        } catch {
          return {
            ok: false,
            message: 'No fue posible conectar con el servidor de autenticacion.',
          };
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as LoginErrorPayload | null;
          return {
            ok: false,
            message: payload?.message?.trim() || 'Credenciales invalidas.',
            expired: payload?.expired === true,
          };
        }

        const payload = (await response.json().catch(() => null)) as LoginSuccessPayload | null;
        const user = asAuthUser(payload?.user);
        if (!user) {
          return {
            ok: false,
            message: 'Respuesta de autenticacion invalida.',
          };
        }

        set({ user });

        if (user.role === 'superadmin') {
          setApiProfileOverrideInBrowser(getApiProfileOverrideFromBrowser());
        }

        return { ok: true };
      },
      logout: async () => {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
        set({ user: null });
      },
      clearLocalUser: () => {
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
