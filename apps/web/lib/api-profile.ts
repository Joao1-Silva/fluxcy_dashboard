import type { ApiProfile } from '@/types/api-profile';
import type { AuthRole } from '@/types/auth';

export const API_PROFILE_OVERRIDE_COOKIE = 'fluxcy_api_profile';
export const API_PROFILE_OVERRIDE_STORAGE_KEY = 'fluxcy-api-profile-override';

export const WELLTECH_EQUIPO_ID = 2;
export const WELLTECH_PATH_SUFFIX = '/fluxcy/api';

const DEFAULT_EXTERNAL_API_BASE = 'http://api-sermaca.lat/api_aguilera/api';
const DEFAULT_WELLTECH_API_BASE = 'http://api.fluxcy.xyz/fluxcy/api';

function normalizeUrl(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function ensureWelltechPath(baseUrl: string): string {
  if (baseUrl.endsWith('/fluxcy/api')) {
    return baseUrl;
  }

  if (baseUrl.endsWith('/api_aguilera/api')) {
    return baseUrl.replace(/\/api_aguilera\/api$/, WELLTECH_PATH_SUFFIX);
  }

  return `${baseUrl}${WELLTECH_PATH_SUFFIX}`;
}

export function normalizeApiProfile(value: string | null | undefined): ApiProfile {
  return value?.toUpperCase() === 'WELLTECH' ? 'WELLTECH' : 'DEFAULT';
}

export function getApiProfileFromSession({
  role,
  override,
}: {
  role: AuthRole | null | undefined;
  override?: string | null;
}): ApiProfile {
  if (role === 'welltech') {
    return 'WELLTECH';
  }

  if (role === 'superadmin' && normalizeApiProfile(override) === 'WELLTECH') {
    return 'WELLTECH';
  }

  return 'DEFAULT';
}

export function getBaseUrl(profile: ApiProfile): string {
  if (profile === 'WELLTECH') {
    const configured = normalizeUrl(process.env.WELLTECH_API_BASE_URL) || DEFAULT_WELLTECH_API_BASE;
    return ensureWelltechPath(configured);
  }

  return normalizeUrl(process.env.EXTERNAL_API_BASE_URL) || DEFAULT_EXTERNAL_API_BASE;
}

export function withEquipoId(
  profile: ApiProfile,
  params?: Record<string, string | number | undefined>,
): Record<string, string | number | undefined> | undefined {
  if (!params && profile !== 'WELLTECH') {
    return params;
  }

  const next: Record<string, string | number | undefined> = { ...(params ?? {}) };
  if (profile === 'WELLTECH') {
    next.equipo_id = WELLTECH_EQUIPO_ID;
  }

  return next;
}

function writeCookie(value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${API_PROFILE_OVERRIDE_COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function setApiProfileOverrideInBrowser(profile: ApiProfile) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(API_PROFILE_OVERRIDE_STORAGE_KEY, profile);
  writeCookie(profile, 60 * 60 * 24 * 30);
}

export function getApiProfileOverrideFromBrowser(): ApiProfile {
  if (typeof window === 'undefined') {
    return 'DEFAULT';
  }

  const value = window.localStorage.getItem(API_PROFILE_OVERRIDE_STORAGE_KEY);
  return normalizeApiProfile(value);
}

export function clearApiProfileOverrideInBrowser() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(API_PROFILE_OVERRIDE_STORAGE_KEY);
  writeCookie('DEFAULT', 0);
}
