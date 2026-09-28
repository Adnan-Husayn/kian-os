import { headers } from "next/headers";

/**
 * CSRF defense-in-depth for mutating server actions.
 *
 * Next.js server actions already validate Sec-Fetch-Site; this adds an
 * explicit Origin/Referer check: the request must carry an Origin (or
 * Referer) whose host matches the request Host. Fails closed — missing or
 * mismatched origins throw.
 *
 * Call this at the top of every mutating server action via
 * `await assertSameOrigin()`.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const host = h.get("host");
  if (!host) throw new Error("Forbidden: unable to verify request origin.");

  const origin = h.get("origin");
  const referer = h.get("referer");
  const candidate = origin ?? referer;
  if (!candidate) {
    throw new Error("Forbidden: missing request origin.");
  }

  let candidateHost: string;
  try {
    candidateHost = new URL(candidate).host;
  } catch {
    throw new Error("Forbidden: invalid request origin.");
  }

  if (candidateHost !== host) {
    throw new Error("Forbidden: origin mismatch.");
  }
}

/**
 * Best-effort client IP for rate limiting. On Cloudflare, cf-connecting-ip is
 * set by the edge and cannot be spoofed, whereas a client-sent
 * X-Forwarded-For survives as the first entry — so it must win. Otherwise
 * reads the standard proxy headers; falls back to "unknown".
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const cfIp = h.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
