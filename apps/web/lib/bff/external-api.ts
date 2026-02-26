const DEFAULT_EXTERNAL_API_BASE = 'http://api-sermaca.lat/api_aguilera/api';

function normalizeUrl(value: string | undefined) {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

const EXTERNAL_API_BASE = normalizeUrl(process.env.EXTERNAL_API_BASE_URL) || DEFAULT_EXTERNAL_API_BASE;

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

export async function fetchExternal(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
): Promise<unknown> {
  const url = `${EXTERNAL_API_BASE}${endpoint}${toQuery(params)}`;
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
