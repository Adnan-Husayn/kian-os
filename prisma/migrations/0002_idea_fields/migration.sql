-- Add exploration fields to Idea (nullable, no backfill needed)
ALTER TABLE "Idea" ADD COLUMN "why" TEXT;
ALTER TABLE "Idea" ADD COLUMN "couldBecome" TEXT;
ALTER TABLE "Idea" ADD COLUMN "nextAction" TEXT;
