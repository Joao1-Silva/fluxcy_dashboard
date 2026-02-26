import { NextResponse } from 'next/server';

import { fetchExternal } from '@/lib/bff/external-api';
import { normalizeSnapshot } from '@/lib/bff/normalizers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [clockmeter, drivgain, temp, possvalve, rholiq, total, densidadapi] = await Promise.all([
      fetchExternal('/clockmeter'),
      fetchExternal('/drivgain'),
      fetchExternal('/temp'),
      fetchExternal('/possvalve'),
      fetchExternal('/rholiq'),
      fetchExternal('/total'),
      fetchExternal('/densidadapi'),
    ]);

    return NextResponse.json(
      normalizeSnapshot({
        clockmeter,
        drivgain,
        temp,
        possvalve,
        rholiq,
        total,
        densidadapi,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
