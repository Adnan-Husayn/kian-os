import { prisma } from "@/lib/db";

/**
 * Postgres-backed sliding-window rate limiter for the login endpoint.
 *
 * Policy: max 10 attempts per 10 minutes per IP, counted from the
 * LoginAttempt table. Rows are pruned opportunistically on each call.
 *
 * This MUST live in the database, not in module memory: on Vercel each
 * serverless instance has its own memory, so an in-memory bucket would let
 * an attacker multiply the allowance by the instance count. The account
 * lockout (3 consecutive failures -> escalating time-based lockout, see
 * actions/auth.ts) remains the real backstop and also lives in the
 * database.
 */

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * Record one login attempt for `key` (usually the client IP).
 * Returns true when the attempt is allowed, false when rate-limited.
 */
export async function consumeLoginAttempt(key: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const recent = await prisma.loginAttempt.count({
    where: { ip: key, createdAt: { gte: windowStart } },
  });
  if (recent >= MAX_ATTEMPTS) return false;

  await prisma.loginAttempt.create({ data: { ip: key } });

  // Opportunistic hygiene: drop rows that can never count again.
  await prisma.loginAttempt
    .deleteMany({ where: { createdAt: { lt: windowStart } } })
    .catch(() => undefined);

  return true;
}
