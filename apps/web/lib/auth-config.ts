import type { AuthUser } from '@/types/auth';

export type BaseAuthUser = AuthUser & {
  password: string;
};

export const BASE_AUTH_USERS: BaseAuthUser[] = [
  {
    username: 'superadmin',
    password: 'SuperAdmin@Fluxcy2026',
    displayName: 'Super Admin',
    role: 'superadmin',
  },
  {
    username: 'supervisor',
    password: 'Supervisor@Fluxcy2026',
    displayName: 'Supervisor de Campo',
    role: 'supervisor',
  },
];
