import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { fetchExternal } from '@/lib/bff/external-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ENDPOINTS = new Set([
  'qm',
  'produccion',
  'clockmeter',
  'clockmeter_qm',
  'databasefluxcy',
  'datos/corrida-pozo',
]);

function toExternalParams(searchParams: URLSearchParams): Record<string, string> | undefined {
  if ([...searchParams.keys()].length === 0) {
    return undefined;
  }

  const params: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value.trim().length > 0) {
      params[key] = value;
    }
  }

  return Object.keys(params).length > 0 ? params : undefined;
}

function asEndpoint(parts: string[]): string | null {
  const normalized = parts.map((part) => part.trim()).filter((part) => part.length > 0).join('/');
  if (!ALLOWED_ENDPOINTS.has(normalized)) {
    return null;
  }
  return `/${normalized}`;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ endpoint: string[] }>;
  },
) {
  const { endpoint } = await context.params;
  const externalEndpoint = asEndpoint(endpoint);
  if (!externalEndpoint) {
    return NextResponse.json({ message: 'Proxy endpoint no soportado.' }, { status: 404 });
  }

  try {
    const payload = await fetchExternal(externalEndpoint, toExternalParams(request.nextUrl.searchParams));
    if (typeof payload === 'string') {
      return new NextResponse(payload, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    const status = message.includes('Finalizo su prueba') ? 403 : 500;
    return NextResponse.json({ message }, { status });
  }
}
