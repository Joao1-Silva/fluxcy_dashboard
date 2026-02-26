import { env } from '../config/env';

interface ApiRequestOptions extends RequestInit {
  token?: string | null;
}

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const joinUrl = (base: string, path: string): string => {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
};

export const apiRequest = async <T>(
  path: string,
  options?: ApiRequestOptions,
): Promise<T> => {
  const headers = new Headers(options?.headers || {});
  headers.set('Content-Type', 'application/json');

  if (options?.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(joinUrl(env.apiBaseUrl, path), {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      (payload && typeof payload.message === 'string' && payload.message) ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
};
