import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { AuthUser } from '@/types/auth';
import { BASE_AUTH_USERS } from '@/lib/auth-config';
import {
  clearCookieOptions,
  createSessionToken,
  createTrialWindowFromNow,
  createWelltechTrialToken,
  getFallbackTrialWindow,
  getWelltechCredentials,
  isTrialExpired,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  WELLTECH_TRIAL_COOKIE_NAME,
  verifyWelltechTrialToken,
  trialCookieOptions,
  ROLE_COOKIE_NAME,
  type WelltechTrialWindow,
} from '@/lib/auth/server-auth';
import {
  clearWelltechFailures,
  getWelltechRateLimitStatus,
  registerWelltechFailure,
} from '@/lib/auth/welltech-rate-limit';
import { readPersistedWelltechTrial, writePersistedWelltechTrial } from '@/lib/auth/welltech-trial-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LoginBody = {
  username: string;
  password: string;
};

function parseBody(payload: unknown): LoginBody | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const raw = payload as Record<string, unknown>;
  const username = typeof raw.username === 'string' ? raw.username.trim() : '';
  const password = typeof raw.password === 'string' ? raw.password : '';
  if (!username || !password) {
    return null;
  }

  return { username, password };
}

function loginError(message: string, status = 401, expired = false) {
  return NextResponse.json(
    {
      message,
      expired,
    },
    { status },
  );
}

function getClientIp(request: NextRequest): string {
  const fromForwarded = request.headers.get('x-forwarded-for');
  if (fromForwarded) {
    return fromForwarded.split(',')[0]?.trim() || 'unknown-ip';
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown-ip';
}

function asAuthUser(input: {
  username: string;
  displayName: string;
  role: AuthUser['role'];
  apiProfile?: AuthUser['apiProfile'];
}): AuthUser {
  return {
    username: input.username,
    displayName: input.displayName,
    role: input.role,
    apiProfile: input.apiProfile,
  };
}

function successResponse(user: AuthUser) {
  return NextResponse.json({
    ok: true,
    user,
  });
}

export async function POST(request: NextRequest) {
  const body = parseBody(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json({ message: 'Credenciales invalidas.' }, { status: 400 });
  }

  const normalizedUsername = body.username.toLowerCase();
  const { username: welltechUsername, password: welltechPassword } = getWelltechCredentials();
  const normalizedWelltech = welltechUsername.toLowerCase();

  if (normalizedUsername === normalizedWelltech) {
    const key = `${normalizedWelltech}:${getClientIp(request)}`;
    const rate = getWelltechRateLimitStatus(key);
    if (rate.limited) {
      return NextResponse.json(
        {
          message: `Demasiados intentos. Intenta nuevamente en ${rate.retryAfterSec}s.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rate.retryAfterSec),
          },
        },
      );
    }

    if (body.password !== welltechPassword) {
      registerWelltechFailure(key);
      return loginError('Credenciales invalidas.', 401);
    }

    const existingTrialToken = request.cookies.get(WELLTECH_TRIAL_COOKIE_NAME)?.value;
    const existingTrial = await verifyWelltechTrialToken(existingTrialToken);
    const fallback = getFallbackTrialWindow();
    let persistedTrial: WelltechTrialWindow | null = null;
    let trialStoreAvailable = true;

    try {
      persistedTrial = await readPersistedWelltechTrial();
    } catch (error) {
      trialStoreAvailable = false;
      console.warn('[auth][welltech] No fue posible leer estado de trial persistido.', error);
    }

    if (existingTrial && isTrialExpired(existingTrial.trialEnd)) {
      const response = loginError(
        'Finalizo su prueba. Contacte a FLUXCY para activar su licencia.',
        403,
        true,
      );
      response.cookies.set(SESSION_COOKIE_NAME, '', clearCookieOptions());
      response.cookies.set(WELLTECH_TRIAL_COOKIE_NAME, '', clearCookieOptions());
      response.cookies.set(ROLE_COOKIE_NAME, '', clearCookieOptions());
      return response;
    }

    let effectiveWindow: WelltechTrialWindow;
    let shouldPersistWindow = false;

    if (existingTrial) {
      effectiveWindow = {
        trialStart: existingTrial.trialStart,
        trialEnd: existingTrial.trialEnd,
      };
      shouldPersistWindow = persistedTrial === null && trialStoreAvailable;
    } else if (persistedTrial) {
      effectiveWindow = persistedTrial;
    } else if (trialStoreAvailable) {
      effectiveWindow = createTrialWindowFromNow();
      shouldPersistWindow = true;
    } else {
      effectiveWindow = fallback;
    }

    if (isTrialExpired(effectiveWindow.trialEnd)) {
      const response = loginError(
        'Finalizo su prueba. Contacte a FLUXCY para activar su licencia.',
        403,
        true,
      );
      response.cookies.set(SESSION_COOKIE_NAME, '', clearCookieOptions());
      response.cookies.set(WELLTECH_TRIAL_COOKIE_NAME, '', clearCookieOptions());
      response.cookies.set(ROLE_COOKIE_NAME, '', clearCookieOptions());
      return response;
    }

    const user = asAuthUser({
      username: welltechUsername,
      displayName: 'WellTech Trial',
      role: 'welltech',
      apiProfile: 'WELLTECH',
    });

    const response = successResponse(user);
    const sessionToken = await createSessionToken(user);
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
    response.cookies.set(ROLE_COOKIE_NAME, '', clearCookieOptions());

    if (shouldPersistWindow) {
      try {
        await writePersistedWelltechTrial(effectiveWindow);
      } catch (error) {
        console.warn('[auth][welltech] No fue posible persistir estado de trial en archivo local.', error);
      }
    }

    if (!existingTrialToken) {
      try {
        const trialToken = await createWelltechTrialToken(effectiveWindow);
        response.cookies.set(WELLTECH_TRIAL_COOKIE_NAME, trialToken, trialCookieOptions(effectiveWindow.trialEnd));
      } catch (error) {
        console.error('[auth][welltech] No fue posible firmar wt_trial, se aplicara fallback de fecha fija.', error);
      }
    }

    clearWelltechFailures(key);
    return response;
  }

  const match = BASE_AUTH_USERS.find(
    (candidate) => candidate.username.toLowerCase() === normalizedUsername && candidate.password === body.password,
  );

  if (!match) {
    return loginError('Credenciales invalidas.', 401);
  }

  const user = asAuthUser({
    username: match.username,
    displayName: match.displayName,
    role: match.role,
    apiProfile: 'DEFAULT',
  });

  const response = successResponse(user);
  const sessionToken = await createSessionToken(user);
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
  response.cookies.set(ROLE_COOKIE_NAME, '', clearCookieOptions());

  return response;
}
