# Kian OS

Kian's personal life-management system — tasks, projects, ideas, notes,
journal, daily planning and fast capture in one calm, private app.

Fully built and working: /today (flagship focus view), /plan (plan tomorrow),
/review, /inbox, /tasks, /projects, /ideas, /notes, /calendar, /journal,
/settings, plus global quick-capture (Ctrl/Cmd+K) and search (Ctrl/Cmd+/).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 (CSS-variable palettes, class-based dark mode) + next-themes
- shadcn-style in-house UI primitives (`src/components/ui`) + lucide-react icons (no emojis, ever) + framer-motion
- Prisma 7 + PostgreSQL (datasource URL lives in `prisma.config.ts` — Prisma 7 requirement)
- bcryptjs (12 rounds) + zod + date-fns / date-fns-tz (Asia/Kolkata)

## Setup

```bash
npm install

# 1. Configure the database
cp .env.example .env
# edit DATABASE_URL (and SEED_USERNAME / SEED_PASSWORD if you like)

# 2. Apply the migration
npx prisma migrate dev        # local dev
# npx prisma migrate deploy   # production

# 3. Create the user + starter content (idempotent — skips if the user exists)
npm run db:seed

# 4. Run it
npm run dev
```

Then sign in at http://localhost:3000/login.

### Useful commands

| Command | What it does |
|---|---|
| `npm run db:seed` | Create the user + seed content. Skips safely if the user already exists (`seed skipped: user exists`). |
| `npm run db:reset-data` | **Deletes all data (tasks, projects, ideas, notes, journal, plans, captures, sessions) but does NOT touch the user account.** No undo. |
| `npx prisma validate` | Validate `prisma/schema.prisma`. |
| `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` | Regenerate the initial migration SQL. |

## Deploy (Vercel + Neon)

1. **Database:** create a free Neon project. Copy the **pooled** connection
   string (it ends with `?sslmode=require`).
2. **Vercel:** import this repo. Set the Build Command to
   `npm run vercel-build` (it runs `prisma generate && prisma migrate deploy
   && next build`, so migrations apply automatically on every deploy).
3. **Environment variables** (Vercel → Project Settings → Environment
   Variables). All are also documented in `.env.example`:
   | Variable | Required | Used for |
   |---|---|---|
   | `DATABASE_URL` | yes | App runtime + `prisma migrate deploy` at build time |
   | `PG_POOL_MAX` | no | pg pool size per serverless instance (default `5`) |
   | `SEED_USERNAME` / `SEED_PASSWORD` | seed only | `npm run db:seed` — run once after the first deploy |
   No `SESSION_SECRET` is needed — session tokens are random 32-byte values;
   only their SHA-256 hash is stored.
4. **Data:** to carry data over from the old database (verified 2026-09-29):
   ```sh
   # on the old machine: plain SQL, no ownership/ACL statements
   pg_dump --no-owner --no-acl -f kian-os-dump.sql "$OLD_DATABASE_URL"
   # into Neon (creates all tables AND the _prisma_migrations history)
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f kian-os-dump.sql
   ```
   The dump carries the migration history, so the first Vercel deploy's
   `migrate deploy` will apply only newer migrations on top — nothing to
   mark manually. For a fresh start instead, skip the dump and run
   `npm run db:seed` once (idempotent: skips if the user exists).
5. Deploy. The app is stateless: secure httpOnly cookies work behind Vercel's
   proxy, login rate limiting and the lockout counters live in Postgres, and
   nothing depends on the old VM (no `relay/`, no `keepalive`, no local paths).

## Security model

- **Passwords:** bcrypt, 12 rounds. Never logged, never returned.
- **Sessions:** 32-byte random token in an httpOnly, SameSite=Lax cookie (`kianos_session`, Secure in production, 30-day expiry). The DB stores only the SHA-256 hash.
- **Login hardening:** per-IP sliding-window rate limiting stored in Postgres
  (10 attempts / 10 min, shared across serverless instances), explicit
  Origin/Referer CSRF check on mutations, and the login action always returns
  the single generic message `Invalid username or password.` — it never reveals
  whether the username, password, lockout state, or rate limit was the cause.
  A dummy bcrypt compare runs for unknown users to blunt timing-based user
  enumeration.
- **Auth gate:** `src/proxy.ts` (Next.js 16's renamed middleware) redirects cookie-less requests to `/login` without touching the DB; `requireUser()` in the `(app)` layout does the real session validation.
- **Security headers** in `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.

### Escalating time-based lockout

**Read this before deploying.** After 3 consecutive failed sign-in attempts a
time-based lockout engages (set atomically in the same transaction as the 3rd
failure). The duration escalates with each engagement: **15 min → 1 h → 6 h →
24 h**. A successful login resets both the failure counter and the escalation
tier. This keeps the brute-force backstop without letting anyone on the
internet permanently lock the owner out.

- A locked account gets the same generic error as a wrong password — there is no UI indication of the lockout.
- Clearing a lockout requires direct database access, e.g.:
  ```sql
  UPDATE "User" SET "lockedUntil" = NULL, "failedLoginAttempts" = 0, "lockoutCount" = 0 WHERE username = 'kian';
  ```

## Conventions for feature agents

- **Business logic lives in `src/actions/`** (server actions) and `src/lib/`, never in components. Server Components by default; `"use client"` only where interactivity needs it.
- **Auth:** `requireUser()` (throws → redirects to `/login`) in server components/actions; `getSessionUser()` when you need a nullable check. `assertSameOrigin()` at the top of every mutating action.
- **Dates:** all date-only values (scheduled dates, journal/daily-plan dates) are midnight Asia/Kolkata — use `src/lib/dates.ts` (`todayKolkata()`, `startOfDayKolkata()`, `formatDay()`, …).
- **Validation:** zod schemas in `src/lib/validation.ts`.
- **Capture:** `captureQuick({ content, type })` in `src/actions/capture.ts`.
- **Search:** `searchAll(query)` in `src/actions/search.ts` returns grouped hits; ILIKE-based for now, with a TODO to move to Postgres full-text search.
- **Global shortcuts** (`Cmd/Ctrl+K` capture, `Cmd/Ctrl+/` search, `T` → today): `KeyboardShortcuts` + `ShortcutProvider` (`useShortcuts()` exposes `openCapture()` / `openSearch()`).
- **No emojis in UI** — lucide-react icons only. Reduced-motion is honored globally in CSS.

## Sandbox note (Prisma engines)

If `npx prisma` fails in this sandbox with an `ECONNRESET`/`aborted` TLS error,
it is the Prisma 7 CLI trying to re-download the schema engine through the
restricted egress proxy. The engine is already cached at
`~/.cache/prisma/master/0edf323efd1d98336f3f0a68684b56f689b900d3/debian-openssl-3.0.x/`
(schema-engine + matching `.sha256`), which makes plain `npx prisma …`
work offline. With normal internet access no workaround is needed.
