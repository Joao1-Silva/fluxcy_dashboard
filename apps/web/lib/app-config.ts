const LOCAL_BFF_URL = 'http://localhost:4000';

function normalizeUrl(value: string | undefined) {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value === '1' || value.toLowerCase() === 'true';
}

const bffUrl =
  normalizeUrl(process.env.NEXT_PUBLIC_BFF_URL) ||
  (process.env.NODE_ENV === 'production' ? '' : LOCAL_BFF_URL);
const socketUrl =
  normalizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL) ||
  (process.env.NODE_ENV === 'production' ? '' : bffUrl);

export const APP_CONFIG = {
  bffUrl,
  socketUrl,
  webPort: 3001,
  enableTasksBackend: toBoolean(process.env.NEXT_PUBLIC_ENABLE_TASKS_BACKEND, false),
  sessionCookieName: 'fluxcy_session',
  roleCookieName: 'fluxcy_role',
} as const;
