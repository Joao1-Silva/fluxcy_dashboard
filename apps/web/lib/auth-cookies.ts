import { APP_CONFIG } from '@/lib/app-config';
import type { AuthRole } from '@/types/auth';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function setAuthCookies(role: AuthRole) {
  document.cookie = `${APP_CONFIG.sessionCookieName}=1; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  document.cookie = `${APP_CONFIG.roleCookieName}=${role}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearAuthCookies() {
  document.cookie = `${APP_CONFIG.sessionCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${APP_CONFIG.roleCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}
