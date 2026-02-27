import type { ApiProfile } from '@/types/api-profile';

export type AuthRole = 'superadmin' | 'supervisor' | 'welltech';

export type AuthUser = {
  username: string;
  displayName: string;
  role: AuthRole;
  apiProfile?: ApiProfile;
};

export type AuthLoginInput = {
  username: string;
  password: string;
};

export type AuthLoginResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
      expired?: boolean;
    };
