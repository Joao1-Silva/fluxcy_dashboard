import type { QueryFunctionContext } from '@tanstack/react-query';

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
  const response = await fetch(`${path}${toQuery(options?.params)}`, {
    method: options?.method ?? 'GET',
    headers: DEFAULT_HEADERS,
    signal: options?.signal,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
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


