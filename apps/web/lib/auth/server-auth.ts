import type { ApiProfile } from '@/types/api-profile';
import type { AuthRole, AuthUser } from '@/types/auth';
import { API_PROFILE_OVERRIDE_COOKIE, getApiProfileFromSession, WELLTECH_EQUIPO_ID } from '@/lib/api-profile';

const JWT_ALG = 'HS256';
const JWT_TYP = 'JWT';
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const LEGACY_TRIAL_DAYS = 16;
const TRIAL_BONUS_DAYS = 5;
const TRIAL_DAYS = LEGACY_TRIAL_DAYS + TRIAL_BONUS_DAYS;
const TRIAL_DURATION_MS = TRIAL_DAYS * DAY_MS;
const LEGACY_TRIAL_DURATION_MS = LEGACY_TRIAL_DAYS * DAY_MS;
const TRIAL_BONUS_DURATION_MS = TRIAL_BONUS_DAYS * DAY_MS;
const LEGACY_TRIAL_TOLERANCE_MS = 60 * 1000;
const CARACAS_TIMEZONE = 'America/Caracas';
const CARACAS_OFFSET = '-04:00';
const DEFAULT_TRIAL_FALLBACK_START = '2026-02-27T11:00:00-04:00';

export const SESSION_COOKIE_NAME = 'fluxcy_session';
export const ROLE_COOKIE_NAME = 'fluxcy_role';
export const WELLTECH_TRIAL_COOKIE_NAME = 'wt_trial';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type JwtHeader = {
  alg: typeof JWT_ALG;
  typ: typeof JWT_TYP;
};

type JwtCommonClaims = {
  iat: number;
  exp?: number;
};

type CookieLikeValue = { value?: string } | string | undefined;

type CookieReader = {
  get: (name: string) => CookieLikeValue;
};

type HeaderReader = {
  get: (name: string) => string | null;
};

export type SessionTokenClaims = JwtCommonClaims & {
  sub: string;
  role: AuthRole;
  displayName: string;
  apiProfile: ApiProfile;
  equipoId?: number;
};

export type WelltechTrialClaims = JwtCommonClaims & {
  sub: 'welltech';
  role: 'welltech';
  trialStart: string;
  trialEnd: string;
  apiProfile: 'WELLTECH';
  equipoId: 2;
};

export type WelltechTrialWindow = {
  trialStart: string;
  trialEnd: string;
};

export type ResolvedWelltechTrial = WelltechTrialWindow & {
  source: 'token' | 'fallback';
  expired: boolean;
};

export type ResolvedAuthContext = {
  session: SessionTokenClaims | null;
  role: AuthRole | null;
  profile: ApiProfile;
  trial: ResolvedWelltechTrial | null;
};

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBase64Url(input: Uint8Array): string {
  return toBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4 || 4)) % 4)}`;
  return fromBase64(padded);
}

function asStringRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function isSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function signHmacSha256(content: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(content));
  return toBase64Url(new Uint8Array(signature));
}

function parseJwtSegment(segment: string): Record<string, unknown> | null {
  try {
    const json = decoder.decode(fromBase64Url(segment));
    return asStringRecord(JSON.parse(json));
  } catch {
    return null;
  }
}

function getAuthSecret(): string {
  const candidate = process.env.AUTH_SECRET?.trim();
  if (candidate && candidate.length > 0) {
    return candidate;
  }

  return 'dev-auth-secret-change-me';
}

function normalizeIso(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return toCaracasIso(new Date(parsed));
}

function getDateFormatter() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CARACAS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

export function toCaracasIso(date: Date): string {
  const map: Record<string, string> = {};
  for (const part of getDateFormatter().formatToParts(date)) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}${CARACAS_OFFSET}`;
}

function parseIsoMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isTrialExpired(trialEndIso: string, nowMs = Date.now()): boolean {
  const trialEndMs = parseIsoMs(trialEndIso);
  if (trialEndMs === null) {
    return true;
  }
  return nowMs > trialEndMs;
}

function trialWindowFromStart(startDate: Date): WelltechTrialWindow {
  const trialStart = toCaracasIso(startDate);
  const trialEnd = toCaracasIso(new Date(startDate.getTime() + TRIAL_DURATION_MS));
  return { trialStart, trialEnd };
}

function isLegacyTrialDuration(window: WelltechTrialWindow): boolean {
  const trialStartMs = parseIsoMs(window.trialStart);
  const trialEndMs = parseIsoMs(window.trialEnd);
  if (trialStartMs === null || trialEndMs === null) {
    return false;
  }

  const durationMs = trialEndMs - trialStartMs;
  if (durationMs <= 0) {
    return false;
  }

  return durationMs <= LEGACY_TRIAL_DURATION_MS + LEGACY_TRIAL_TOLERANCE_MS;
}

export function applyWelltechTrialBonus(window: WelltechTrialWindow): WelltechTrialWindow {
  const normalizedWindow = {
    trialStart: normalizeIso(window.trialStart),
    trialEnd: normalizeIso(window.trialEnd),
  };

  if (!isLegacyTrialDuration(normalizedWindow)) {
    return normalizedWindow;
  }

  const trialEndMs = parseIsoMs(normalizedWindow.trialEnd);
  if (trialEndMs === null) {
    return normalizedWindow;
  }

  return {
    trialStart: normalizedWindow.trialStart,
    trialEnd: toCaracasIso(new Date(trialEndMs + TRIAL_BONUS_DURATION_MS)),
  };
}

export function getFallbackTrialWindow(): WelltechTrialWindow {
  const configured = process.env.TRIAL_FALLBACK_START?.trim() || DEFAULT_TRIAL_FALLBACK_START;
  const parsed = new Date(configured);
  const startDate = Number.isNaN(parsed.getTime()) ? new Date(DEFAULT_TRIAL_FALLBACK_START) : parsed;
  return trialWindowFromStart(startDate);
}

export function createTrialWindowFromNow(): WelltechTrialWindow {
  return trialWindowFromStart(new Date());
}

function parseCookieValue(value: CookieLikeValue): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  return typeof value.value === 'string' ? value.value : undefined;
}

export function getCookieValue(reader: CookieReader | null | undefined, key: string): string | undefined {
  if (!reader) {
    return undefined;
  }
  return parseCookieValue(reader.get(key));
}

function getHeaderValue(reader: HeaderReader | null | undefined, key: string): string | undefined {
  if (!reader) {
    return undefined;
  }
  const value = reader.get(key);
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function signJwtPayload(payload: Record<string, unknown>): Promise<string> {
  const header: JwtHeader = { alg: JWT_ALG, typ: JWT_TYP };
  const encodedHeader = toBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHmacSha256(content, getAuthSecret());
  return `${content}.${signature}`;
}

async function verifyJwtPayload(token: string | null | undefined): Promise<Record<string, unknown> | null> {
  if (!token) {
    return null;
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const header = parseJwtSegment(encodedHeader);
  if (!header || header.alg !== JWT_ALG || header.typ !== JWT_TYP) {
    return null;
  }

  const expected = await signHmacSha256(`${encodedHeader}.${encodedPayload}`, getAuthSecret());
  if (!isSafeEqual(expected, signature)) {
    return null;
  }

  const payload = parseJwtSegment(encodedPayload);
  if (!payload) {
    return null;
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  if (exp !== undefined && exp <= nowSeconds()) {
    return null;
  }

  return payload;
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'superadmin' || value === 'supervisor' || value === 'welltech';
}

function isApiProfile(value: unknown): value is ApiProfile {
  return value === 'DEFAULT' || value === 'WELLTECH';
}

export async function createSessionToken(user: AuthUser): Promise<string> {
  const issuedAt = nowSeconds();
  const payload: SessionTokenClaims = {
    sub: user.username,
    role: user.role,
    displayName: user.displayName,
    apiProfile: user.apiProfile ?? (user.role === 'welltech' ? 'WELLTECH' : 'DEFAULT'),
    equipoId: user.role === 'welltech' ? WELLTECH_EQUIPO_ID : undefined,
    iat: issuedAt,
    exp: issuedAt + SESSION_COOKIE_MAX_AGE_SECONDS,
  };

  return signJwtPayload(payload as unknown as Record<string, unknown>);
}

export async function verifySessionToken(token: string | null | undefined): Promise<SessionTokenClaims | null> {
  const payload = await verifyJwtPayload(token);
  if (!payload) {
    return null;
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const role = payload.role;
  const displayName = typeof payload.displayName === 'string' ? payload.displayName : '';
  const apiProfile = payload.apiProfile;
  const iat = typeof payload.iat === 'number' ? payload.iat : 0;
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  const equipoId = typeof payload.equipoId === 'number' ? payload.equipoId : undefined;

  if (!sub || !displayName || !isAuthRole(role) || !isApiProfile(apiProfile) || !iat) {
    return null;
  }

  return {
    sub,
    role,
    displayName,
    apiProfile,
    equipoId,
    iat,
    exp,
  };
}

export async function createWelltechTrialToken(window: WelltechTrialWindow): Promise<string> {
  const issuedAt = nowSeconds();
  const trialEndMs = parseIsoMs(window.trialEnd) ?? Date.now();
  const payload: WelltechTrialClaims = {
    sub: 'welltech',
    role: 'welltech',
    trialStart: normalizeIso(window.trialStart),
    trialEnd: normalizeIso(window.trialEnd),
    apiProfile: 'WELLTECH',
    equipoId: WELLTECH_EQUIPO_ID,
    iat: issuedAt,
    exp: Math.floor(trialEndMs / 1000),
  };

  return signJwtPayload(payload as unknown as Record<string, unknown>);
}

export async function verifyWelltechTrialToken(
  token: string | null | undefined,
): Promise<WelltechTrialClaims | null> {
  const payload = await verifyJwtPayload(token);
  if (!payload) {
    return null;
  }

  const claimSub = payload.sub;
  const claimRole = payload.role;
  const claimStart = payload.trialStart;
  const claimEnd = payload.trialEnd;
  const claimProfile = payload.apiProfile;
  const claimEquipoId = payload.equipoId;
  const iat = typeof payload.iat === 'number' ? payload.iat : 0;
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;

  if (
    claimSub !== 'welltech' ||
    claimRole !== 'welltech' ||
    typeof claimStart !== 'string' ||
    typeof claimEnd !== 'string' ||
    claimProfile !== 'WELLTECH' ||
    claimEquipoId !== WELLTECH_EQUIPO_ID ||
    !iat
  ) {
    return null;
  }

  const normalizedWindow = applyWelltechTrialBonus({
    trialStart: claimStart,
    trialEnd: claimEnd,
  });

  return {
    sub: 'welltech',
    role: 'welltech',
    trialStart: normalizedWindow.trialStart,
    trialEnd: normalizedWindow.trialEnd,
    apiProfile: 'WELLTECH',
    equipoId: WELLTECH_EQUIPO_ID,
    iat,
    exp,
  };
}

export async function resolveWelltechTrialFromTokenOrFallback(
  token: string | null | undefined,
): Promise<ResolvedWelltechTrial> {
  const fromToken = await verifyWelltechTrialToken(token);
  if (fromToken) {
    return {
      source: 'token',
      trialStart: fromToken.trialStart,
      trialEnd: fromToken.trialEnd,
      expired: isTrialExpired(fromToken.trialEnd),
    };
  }

  const fallback = getFallbackTrialWindow();
  return {
    source: 'fallback',
    ...fallback,
    expired: isTrialExpired(fallback.trialEnd),
  };
}

export async function resolveAuthContextFromReaders({
  cookieReader,
  headerReader,
}: {
  cookieReader: CookieReader | null | undefined;
  headerReader: HeaderReader | null | undefined;
}): Promise<ResolvedAuthContext> {
  const sessionToken = getCookieValue(cookieReader, SESSION_COOKIE_NAME);
  const session = await verifySessionToken(sessionToken);

  const overrideValue =
    getHeaderValue(headerReader, 'x-api-profile') ?? getCookieValue(cookieReader, API_PROFILE_OVERRIDE_COOKIE);
  const role = session?.role ?? null;
  const profile = getApiProfileFromSession({ role, override: overrideValue });

  const trial =
    role === 'welltech'
      ? await resolveWelltechTrialFromTokenOrFallback(getCookieValue(cookieReader, WELLTECH_TRIAL_COOKIE_NAME))
      : null;

  return {
    session,
    role,
    profile,
    trial,
  };
}

function secureCookie(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function sessionCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'lax' as const,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

export function trialCookieOptions(trialEndIso: string) {
  const trialEndMs = parseIsoMs(trialEndIso) ?? Date.now();
  const remainingSeconds = Math.max(1, Math.floor((trialEndMs - Date.now()) / 1000));

  return {
    path: '/',
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'lax' as const,
    maxAge: remainingSeconds,
  };
}

export function clearCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'lax' as const,
    maxAge: 0,
  };
}

export function getWelltechCredentials() {
  return {
    username: process.env.WELLTECH_USERNAME?.trim() || 'welltech',
    password: process.env.WELLTECH_PASSWORD?.trim() || 'welltech123',
  };
}
