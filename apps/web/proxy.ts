import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  clearCookieOptions,
  resolveAuthContextFromReaders,
  ROLE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  WELLTECH_TRIAL_COOKIE_NAME,
} from '@/lib/auth/server-auth';

function isBypassedPath(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/socket.io') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

function isProtectedPath(pathname: string) {
  return pathname.startsWith('/dashboard') || pathname.startsWith('/reports') || pathname.startsWith('/tasks');
}

function redirectExpired(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login?expired=1', request.url));
  response.cookies.set(SESSION_COOKIE_NAME, '', clearCookieOptions());
  response.cookies.set(ROLE_COOKIE_NAME, '', clearCookieOptions());
  response.cookies.set(WELLTECH_TRIAL_COOKIE_NAME, '', clearCookieOptions());
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isBypassedPath(pathname)) {
    return NextResponse.next();
  }

  const auth = await resolveAuthContextFromReaders({
    cookieReader: request.cookies,
    headerReader: request.headers,
  });

  if (!auth.session && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname === '/login') {
    if (!auth.session) {
      return NextResponse.next();
    }

    if (auth.role === 'welltech' && auth.trial?.expired) {
      return redirectExpired(request);
    }

    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (auth.role === 'welltech' && isProtectedPath(pathname) && auth.trial?.expired) {
    return redirectExpired(request);
  }

  if (pathname.startsWith('/tasks')) {
    if (auth.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
