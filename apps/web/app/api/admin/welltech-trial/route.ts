import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

import {
  applyWelltechTrialBonus,
  getFallbackTrialWindow,
  isTrialExpired,
  resolveAuthContextFromReaders,
} from '@/lib/auth/server-auth';
import { readPersistedWelltechTrial } from '@/lib/auth/welltech-trial-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseIsoMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDaysHours(remainingMs: number) {
  const totalHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return { days, hours };
}

export async function GET() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const auth = await resolveAuthContextFromReaders({
    cookieReader: cookieStore,
    headerReader: headerStore,
  });

  if (auth.role !== 'superadmin') {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 403 });
  }

  let persisted = null;
  let source: 'first_login' | 'fallback' = 'fallback';
  try {
    persisted = await readPersistedWelltechTrial();
    if (persisted) {
      source = 'first_login';
    }
  } catch (error) {
    console.warn('[admin][welltech-trial] No fue posible leer estado persistido.', error);
  }

  const trial = applyWelltechTrialBonus(persisted ?? getFallbackTrialWindow());
  const expired = isTrialExpired(trial.trialEnd);
  const trialEndMs = parseIsoMs(trial.trialEnd) ?? Date.now();
  const remainingMs = Math.max(0, trialEndMs - Date.now());
  const remaining = toDaysHours(remainingMs);

  return NextResponse.json({
    source,
    trialStart: trial.trialStart,
    trialEnd: trial.trialEnd,
    expired,
    remainingMs,
    remainingDays: remaining.days,
    remainingHours: remaining.hours,
  });
}
