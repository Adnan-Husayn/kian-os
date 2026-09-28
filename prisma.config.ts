import { defineConfig } from "prisma/config";

// Prisma 7 keeps the datasource URL out of schema.prisma and here instead.
// The app itself never reads this file at runtime — PrismaClient connects
// via DATABASE_URL from the environment (see src/lib/db.ts).
// The CLI (migrate deploy) prefers DIRECT_URL: Neon's pooled endpoint runs
// PgBouncer in transaction mode, which can break migrate's advisory lock.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
