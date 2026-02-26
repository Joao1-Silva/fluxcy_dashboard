import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { APP_CONFIG } from '@/lib/app-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FOCUS_VALUES = new Set(['flow', 'pressure', 'density', 'power', 'watercut']);

type AnalyzeBody = {
  from: string;
  to: string;
  timezone: string;
  pozo?: string;
  focus?: string[];
};

function parseBody(body: unknown): AnalyzeBody | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const value = body as Record<string, unknown>;
  const from = typeof value.from === 'string' ? value.from : '';
  const to = typeof value.to === 'string' ? value.to : '';
  const timezone = typeof value.timezone === 'string' ? value.timezone : '';
  const pozo = typeof value.pozo === 'string' && value.pozo.trim().length > 0 ? value.pozo.trim() : undefined;

  if (!from || !to || !timezone) {
    return null;
  }

  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
    return null;
  }

  const focusArray = Array.isArray(value.focus)
    ? value.focus.filter((item): item is string => typeof item === 'string' && FOCUS_VALUES.has(item))
    : undefined;

  return {
    from,
    to,
    timezone,
    pozo,
    focus: focusArray && focusArray.length > 0 ? focusArray : undefined,
  };
}

async function parseResponse(response: Response): Promise<unknown> {
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

async function forwardAnalyze(input: AnalyzeBody) {
  if (!APP_CONFIG.bffUrl) {
    return NextResponse.json(
      {
        message:
          'Assistant backend is not configured. Set NEXT_PUBLIC_BFF_URL or run local BFF on http://localhost:4000.',
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${APP_CONFIG.bffUrl}/assistant/analyze`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const payload = await parseResponse(response);
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && !Array.isArray(payload) && 'message' in payload
          ? String((payload as Record<string, unknown>).message)
          : `Assistant error ${response.status}`;
      return NextResponse.json(
        {
          message,
          details: payload,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected assistant proxy error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = parseBody(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json(
      { message: 'Invalid body. Required: from, to, timezone (ISO range with from < to).' },
      { status: 400 },
    );
  }

  return forwardAnalyze(body);
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from') ?? '';
  const to = request.nextUrl.searchParams.get('to') ?? '';
  const timezone = request.nextUrl.searchParams.get('timezone') ?? '';
  const pozo = request.nextUrl.searchParams.get('pozo') ?? undefined;
  const focusParam = request.nextUrl.searchParams.get('focus') ?? '';
  const focus = focusParam
    ? focusParam
        .split(',')
        .map((value) => value.trim())
        .filter((value) => FOCUS_VALUES.has(value))
    : undefined;

  const parsed = parseBody({ from, to, timezone, pozo, focus });
  if (!parsed) {
    return NextResponse.json(
      { message: 'Invalid query. Required: from, to, timezone (ISO range with from < to).' },
      { status: 400 },
    );
  }

  return forwardAnalyze(parsed);
}
