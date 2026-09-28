import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function createClient(): PrismaClient {
  // Lazy: Pool does not open connections until the first query, so this is
  // safe to evaluate at import time (including during `next build`).
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 5),
  });
  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Cloudflare Workers forbid reusing a socket opened during another request,
 * so a process-wide pool breaks there: on Workers each request gets its own
 * client (React's cache() memoizes per server request). Everywhere else —
 * `next dev`, seed/reset scripts — one shared client is kept on globalThis,
 * which also survives dev hot reloads.
 */
const isWorkers =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const getRequestClient = cache(createClient);

function getClient(): PrismaClient {
  if (isWorkers) return getRequestClient();
  return (globalForPrisma.prisma ??= createClient());
}

/**
 * Prisma handle used across the app. The Proxy keeps existing
 * `prisma.task.findMany()` call sites unchanged while resolving the right
 * client on each access.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
