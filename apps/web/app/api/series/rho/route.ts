import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { fetchExternal } from '@/lib/bff/external-api';
import { normalizeSeries } from '@/lib/bff/normalizers';
import { parseRangeQuery } from '@/lib/bff/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const range = parseRangeQuery(request);
  if (!range.ok) {
    return NextResponse.json({ message: range.message }, { status: 400 });
  }

  try {
    const payload = await fetchExternal('/rho', {
      from: range.data.from,
      to: range.data.to,
    });

    return NextResponse.json(normalizeSeries(payload, ['rho_liq', 'rho_gas']));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    const status = message.includes('Finalizo su prueba') ? 403 : 500;
    return NextResponse.json({ message }, { status });
  }
}
