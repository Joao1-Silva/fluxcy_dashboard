import type { QueryFunctionContext } from '@tanstack/react-query';

import { API_PROFILE_OVERRIDE_STORAGE_KEY, normalizeApiProfile } from '@/lib/api-profile';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

function toQuery(params?: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        search.set(key, String(value));
      }
    });
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchJson<T>(
  path: string,
  options?: {
    params?: Record<string, string | number | undefined>;
    signal?: AbortSignal;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
  },
): Promise<T> {
  const requestHeaders = new Headers(DEFAULT_HEADERS);
  if (typeof window !== 'undefined' && path.startsWith('/api/')) {
    const profile = normalizeApiProfile(window.localStorage.getItem(API_PROFILE_OVERRIDE_STORAGE_KEY));
    if (profile === 'WELLTECH') {
      requestHeaders.set('x-api-profile', 'WELLTECH');
    }
  }

  const response = await fetch(`${path}${toQuery(options?.params)}`, {
    method: options?.method ?? 'GET',
    headers: requestHeaders,
    signal: options?.signal,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { message?: unknown };
      if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
        message = parsed.message;
      }
    } catch {
      // Keep raw text body.
    }

    if (
      typeof window !== 'undefined' &&
      response.status === 403 &&
      message.toLowerCase().includes('finalizo su prueba')
    ) {
      window.location.href = '/login?expired=1';
    }

    throw new Error(message || `Error ${response.status} en ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function querySignal(context: QueryFunctionContext) {
  return context.signal;
}


