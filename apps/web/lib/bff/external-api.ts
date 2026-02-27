import { cookies, headers } from 'next/headers';

import type { ApiProfile } from '@/types/api-profile';
import { getBaseUrl, withEquipoId } from '@/lib/api-profile';
import { resolveAuthContextFromReaders } from '@/lib/auth/server-auth';

function toQuery(params?: Record<string, string | number | undefined>) {
  if (!params) {
    return '';
  }

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      query.set(key, String(value));
    }
  });

  const encoded = query.toString();
  return encoded.length > 0 ? `?${encoded}` : '';
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

type ExternalRouting = {
  profile: ApiProfile;
};

async function resolveExternalRouting(): Promise<ExternalRouting> {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    const auth = await resolveAuthContextFromReaders({
      cookieReader: cookieStore,
      headerReader: headerStore,
    });

    if (auth.role === 'welltech' && auth.trial?.expired) {
      throw new Error('Finalizo su prueba. Contacte a FLUXCY para activar su licencia.');
    }

    return {
      profile: auth.profile,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Finalizo su prueba')) {
      throw error;
    }

    return {
      profile: 'DEFAULT',
    };
  }
}

export async function fetchExternal(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
): Promise<unknown> {
  const routing = await resolveExternalRouting();
  const baseUrl = getBaseUrl(routing.profile);
  const resolvedParams = withEquipoId(routing.profile, params);
  const url = `${baseUrl}${endpoint}${toQuery(resolvedParams)}`;
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  });

  const body = await parseResponseBody(response);
  if (!response.ok) {
    const message = typeof body === 'string' && body.length > 0 ? body : `External API error ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export async function fetchWithRangeFallback(
  endpoint: string,
  params: Record<string, string | number | undefined>,
): Promise<unknown> {
  try {
    return await fetchExternal(endpoint, params);
  } catch {
    return fetchExternal(endpoint);
  }
}
