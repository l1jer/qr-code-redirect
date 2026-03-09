/**
 * Simple in-memory rate limiter keyed by IP.
 * Tracks failed attempts; blocks further tries after threshold until window expires.
 * Vercel serverless: each cold start resets state, but this still defeats sustained brute-force.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

interface Entry {
  count: number;
  firstAttempt: number;
}

const store = new Map<string, Entry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.firstAttempt > WINDOW_MS) store.delete(key);
  }
}

export function isRateLimited(ip: string): boolean {
  cleanup();
  const entry = store.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > WINDOW_MS) {
    store.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    store.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(ip: string): void {
  store.delete(ip);
}

export function remainingSeconds(ip: string): number {
  const entry = store.get(ip);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.firstAttempt;
  return Math.max(0, Math.ceil((WINDOW_MS - elapsed) / 1000));
}
