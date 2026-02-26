import { env } from '../config/env';
import { apiRequest } from '../lib/apiClient';
import type { AuthSession, LoginPayload, User } from '../types/auth';

interface LoginApiResponse {
  token?: string;
  access_token?: string;
  user?: User;
  data?: {
    token?: string;
    access_token?: string;
    user?: User;
  };
}

interface LocalAuthUser extends User {
  password: string;
  token?: string;
  active?: boolean;
}

interface LocalAuthPayload {
  users?: LocalAuthUser[];
}

const resolveToken = (payload: LoginApiResponse): string | null =>
  payload.token || payload.access_token || payload.data?.token || payload.data?.access_token || null;

const resolveUser = (payload: LoginApiResponse, email: string): User =>
  payload.user || payload.data?.user || { name: email, email };

const fetchLocalUsers = async (): Promise<LocalAuthUser[]> => {
  const response = await fetch(env.localAuthUsersPath, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar el archivo local de usuarios.');
  }

  const payload = (await response.json()) as LocalAuthPayload;
  return Array.isArray(payload.users) ? payload.users : [];
};

const loginWithLocalUsers = async (credentials: LoginPayload): Promise<AuthSession> => {
  const users = await fetchLocalUsers();

  const matched = users.find(
    (user) =>
      user.email?.toLowerCase() === credentials.email.toLowerCase() &&
      user.password === credentials.password &&
      user.active !== false,
  );

  if (!matched) {
    throw new Error('Credenciales invalidas para login local.');
  }

  return {
    token: matched.token || `local-${matched.id || matched.email || 'user'}-token`,
    user: {
      id: matched.id,
      name: matched.name,
      email: matched.email,
      role: matched.role,
    },
  };
};

export const loginRequest = async (credentials: LoginPayload): Promise<AuthSession> => {
  if (env.enableDemoMode) {
    return {
      token: 'demo-token',
      user: {
        id: 'demo-user',
        name: 'Demo Operator',
        email: credentials.email,
        role: 'admin',
      },
    };
  }

  try {
    const payload = await apiRequest<LoginApiResponse>(env.authLoginPath, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    const token = resolveToken(payload);

    if (!token) {
      throw new Error('No se recibio token desde el endpoint de login.');
    }

    return {
      token,
      user: resolveUser(payload, credentials.email),
    };
  } catch (error) {
    if (!env.enableLocalAuthFallback) {
      throw error;
    }

    return loginWithLocalUsers(credentials);
  }
};
