-- Bullet-journal migration: a plan row moved forward to a later day stays on
-- its original day, marked with the time it was moved (shown as ">").
ALTER TABLE "DailyPlanTask" ADD COLUMN "migratedAt" TIMESTAMP(3);
