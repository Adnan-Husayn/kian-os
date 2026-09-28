import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function getPool(): Pool {
  if (!globalForPrisma.pgPool) {
    // Lazy: Pool does not open connections until the first query, so this is
    // safe to evaluate at import time (including during `next build`).
    globalForPrisma.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Serverless-safe default: each Vercel instance keeps a small pool so
      // concurrent instances can't exhaust the database connection limit.
      // Override with PG_POOL_MAX when needed.
      max: Number(process.env.PG_POOL_MAX ?? 5),
    });
  }
  return globalForPrisma.pgPool;
}

/**
 * Prisma singleton (Prisma 7 requires a driver adapter).
 * In dev, Next.js hot-reloads modules on every edit — caching the client and
 * pool on globalThis avoids exhausting DB connections.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
