/** Name of the session cookie. Kept dependency-free so the edge proxy
 * (src/proxy.ts) can import it without pulling in Prisma. */
export const SESSION_COOKIE = "kianos_session";

/** Session lifetime: 30 days, in seconds. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Consecutive failed sign-in attempts before a lockout engages.
 * The lockout is applied atomically with the Nth failure in actions/auth.ts.
 */
export const MAX_FAILED_LOGIN_ATTEMPTS = 3;

/**
 * Escalating lockout durations, indexed by how many lockouts have already
 * engaged (capped at the last tier): 15 min, 1 h, 6 h, then 24 h.
 * A successful login resets the escalation back to the first tier.
 */
export const LOCKOUT_DURATIONS_MS = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];
