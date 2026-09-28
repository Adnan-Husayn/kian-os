"use server";

import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroySession,
  getSessionUser,
} from "@/lib/auth/session";
import { consumeLoginAttempt } from "@/lib/auth/rate-limit";
import { assertSameOrigin, getClientIp } from "@/lib/auth/csrf";
import { loginSchema } from "@/lib/validation";
import {
  LOCKOUT_DURATIONS_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "@/lib/auth/constants";

/**
 * The ONLY error message ever returned from login. Never reveals whether the
 * username was wrong, the password was wrong, the account is locked, or the
 * request was rate-limited / failed CSRF.
 */
const GENERIC_ERROR = "Invalid username or password.";

/**
 * Dummy bcrypt hash used when the username does not exist, so the response
 * time is indistinguishable from a real password check (timing-attack
 * mitigation for user enumeration).
 */
const DUMMY_HASH =
  "$2b$12$KIXxQGvHlN9m0vQy2Z9r8eJvXyZ0aBcDeFgHiJkLmNoPqRsTuVwXyZ012";

/** Result of the login server action. */
export interface LoginResult {
  ok: boolean;
  error?: string;
}

/**
 * Authenticate a user. On success a session cookie is set.
 *
 * Security properties:
 * - zod-validates input
 * - per-IP sliding-window rate limiting in Postgres (10 attempts / 10 min),
 *   shared across serverless instances
 * - explicit Origin/Referer CSRF check
 * - failed attempts increment atomically; when the count reaches
 *   MAX_FAILED_LOGIN_ATTEMPTS a time-based lockout engages in the same
 *   transaction, escalating 15m -> 1h -> 6h -> 24h on repeat lockouts
 * - locked accounts get the exact same generic error as bad credentials
 * - successful login resets the failure counter and the escalation tier
 */
export async function login(
  _prevState: LoginResult,
  formData: FormData,
): Promise<LoginResult> {
  try {
    await assertSameOrigin();
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  const ip = await getClientIp();
  if (!(await consumeLoginAttempt(ip))) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const { username, password } = parsed.data;

  // IMPORTANT: every early return below uses GENERIC_ERROR.
  const authenticatedUserId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { username } });

    if (!user) {
      // Burn comparable time so "unknown user" isn't distinguishable.
      await verifyPassword(password, DUMMY_HASH).catch(() => false);
      return null;
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      // Lockout still active — run the (failing) check so timing matches a
      // real attempt, then fail with the generic error.
      await verifyPassword(password, DUMMY_HASH).catch(() => false);
      return null;
    }
    if (user.lockedUntil) {
      // A previous lockout expired: clear it. lockoutCount is kept so the
      // next lockout keeps escalating; only a success resets the tier.
      await tx.user.update({
        where: { id: user.id },
        data: { lockedUntil: null },
      });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (ok) {
      if (
        user.failedLoginAttempts !== 0 ||
        user.lockoutCount !== 0 ||
        user.lockedUntil !== null
      ) {
        await tx.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockoutCount: 0, lockedUntil: null },
        });
      }
      return user.id;
    }

    // Failure path: atomic increment, then engage a lockout in the SAME
    // transaction when the fresh count reaches the limit. `increment` is
    // atomic at the DB level, so concurrent failures can't both slip under
    // the limit. The lockout duration escalates with each engagement.
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true, lockoutCount: true },
    });
    if (updated.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const tier = Math.min(
        updated.lockoutCount,
        LOCKOUT_DURATIONS_MS.length - 1,
      );
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockoutCount: { increment: 1 },
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATIONS_MS[tier]),
        },
      });
    }
    return null;
  });

  if (!authenticatedUserId) {
    return { ok: false, error: GENERIC_ERROR };
  }

  await createSession(authenticatedUserId);
  return { ok: true };
}

/** Destroy the current session and clear the cookie. */
export async function logout(): Promise<void> {
  try {
    await assertSameOrigin();
  } catch {
    // Even on CSRF failure, destroy the local session state — failing closed.
  }
  await destroySession();
}

/** Convenience re-export for server components that need the session user. */
export async function currentUser() {
  return getSessionUser();
}
