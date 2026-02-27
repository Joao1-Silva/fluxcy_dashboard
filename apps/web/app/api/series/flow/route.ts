import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { fetchExternal } from '@/lib/bff/external-api';
import { normalizeSeries } from '@/lib/bff/normalizers';
import { parseEnumParam, parseNumberParam, parseRangeQuery } from '@/lib/bff/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const range = parseRangeQuery(request);
  if (!range.ok) {
    return NextResponse.json({ message: range.message }, { status: 400 });
  }

  const smooth = parseEnumParam(request, 'smooth', ['0', '1'] as const);
  if (!smooth.ok) {
    return NextResponse.json({ message: smooth.message }, { status: 400 });
  }

  const alpha = parseNumberParam(request, 'alpha', 0, 1);
  if (!alpha.ok) {
    return NextResponse.json({ message: alpha.message }, { status: 400 });
  }

  try {
    const payload = await fetchExternal('/qm', {
      from: range.data.from,
      to: range.data.to,
      smooth: smooth.data ?? '1',
      alpha: alpha.data,
    });

    return NextResponse.json(normalizeSeries(payload, ['qm_liq', 'qm_gas']));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    const status = message.includes('Finalizo su prueba') ? 403 : 500;
    return NextResponse.json({ message }, { status });
  }
}
