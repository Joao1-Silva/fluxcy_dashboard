import { NextResponse } from 'next/server';

import { API_PROFILE_OVERRIDE_COOKIE } from '@/lib/api-profile';
import { clearCookieOptions, ROLE_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/auth/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', clearCookieOptions());
  response.cookies.set(ROLE_COOKIE_NAME, '', clearCookieOptions());
  response.cookies.set(API_PROFILE_OVERRIDE_COOKIE, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
