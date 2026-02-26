export type AuthRole = 'superadmin' | 'supervisor';

export type AuthUser = {
  username: string;
  displayName: string;
  role: AuthRole;
};

export type AuthLoginInput = {
  username: string;
  password: string;
};

export type AuthLoginResult = {
  ok: boolean;
  message?: string;
};
