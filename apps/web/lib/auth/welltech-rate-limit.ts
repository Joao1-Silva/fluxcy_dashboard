const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 7;

const attemptsByKey = new Map<string, number[]>();

function pruneAttempts(key: string, nowMs: number): number[] {
  const attempts = attemptsByKey.get(key) ?? [];
  const active = attempts.filter((timestamp) => nowMs - timestamp < WINDOW_MS);
  if (active.length > 0) {
    attemptsByKey.set(key, active);
  } else {
    attemptsByKey.delete(key);
  }
  return active;
}

export function registerWelltechFailure(key: string): void {
  const now = Date.now();
  const attempts = pruneAttempts(key, now);
  attempts.push(now);
  attemptsByKey.set(key, attempts);
}

export function clearWelltechFailures(key: string): void {
  attemptsByKey.delete(key);
}

export function getWelltechRateLimitStatus(key: string): {
  limited: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const attempts = pruneAttempts(key, now);

  if (attempts.length < MAX_ATTEMPTS) {
    return {
      limited: false,
      retryAfterSec: 0,
    };
  }

  const oldest = attempts[0];
  const retryAfterMs = Math.max(0, WINDOW_MS - (now - oldest));
  return {
    limited: true,
    retryAfterSec: Math.ceil(retryAfterMs / 1000),
  };
}
