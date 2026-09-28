-- Time-based escalating lockout replaces the permanent 3-strike lock.
-- Accounts stuck in the old permanent lock get the maximum escalation tier
-- (24h from migration time) instead of staying locked forever.
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lockoutCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "User"
  SET "lockedUntil" = NOW() + INTERVAL '24 hours',
      "lockoutCount" = 3
  WHERE "isLocked" = true;
ALTER TABLE "User" DROP COLUMN "isLocked";
