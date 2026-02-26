import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'fluxcy_session';
const ROLE_COOKIE = 'fluxcy_role';

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isBypassedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/tasks')) {
    const role = request.cookies.get(ROLE_COOKIE)?.value;
    if (role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
