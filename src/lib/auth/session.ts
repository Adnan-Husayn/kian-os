import { randomBytes, createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";

/** User record safe to pass around — never includes the password hash. */
export type SessionUser = Omit<User, "passwordHash">;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionCookieOptions(isSecure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: isSecure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Create a new session for a user. Generates a cryptographically random
 * 32-byte token, stores only its SHA-256 hash in the DB (30-day expiry),
 * sets the httpOnly cookie, and returns the raw token (also returned for
 * completeness — the cookie is the delivery mechanism).
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    },
  });

  // Opportunistic hygiene: drop expired sessions for this user.
  await prisma.session
    .deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
    .catch(() => undefined);

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(process.env.NODE_ENV === "production"),
  );

  return token;
}

/**
 * Resolve the current request's session cookie to a user, or null when there
 * is no valid (unexpired, existing) session.
 *
 * Memoized per request with React cache(): the layout, the page and helpers
 * like getOrCreateDailyPlan all call requireUser(), and each lookup is a
 * round trip to the database.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.session
        .delete({ where: { id: session.id } })
        .catch(() => undefined);
    }
    return null;
  }

  const { passwordHash: _passwordHash, ...safeUser } = session.user;
  return safeUser;
});

/**
 * Guard for protected server components/actions/routes. Redirects to /login
 * when there is no valid session.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Destroy the current session (DB row + cookie). Safe to call without one. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }
  cookieStore.delete(SESSION_COOKIE);
}
