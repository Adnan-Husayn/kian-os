/**
 * DANGER: deletes ALL application data for every user — tasks, projects,
 * ideas, notes, journal entries, daily plans, captures and sessions.
 *
 * It does NOT touch the User rows: your account (username, password hash,
 * lockout state) survives. There is no undo; use only when you mean it.
 *
 * Usage: npm run db:reset-data
 */
import { prisma } from "../src/lib/db";

async function main() {
  // Delete in dependency order (children before parents). Task subtasks and
  // DailyPlanTask rows cascade, but explicit ordering keeps this robust.
  const deleted = {
    dailyPlanTasks: (await prisma.dailyPlanTask.deleteMany()).count,
    dailyPlans: (await prisma.dailyPlan.deleteMany()).count,
    captures: (await prisma.capture.deleteMany()).count,
    journalEntries: (await prisma.journalEntry.deleteMany()).count,
    notes: (await prisma.note.deleteMany()).count,
    tasks: (await prisma.task.deleteMany()).count,
    projects: (await prisma.project.deleteMany()).count,
    ideas: (await prisma.idea.deleteMany()).count,
    sessions: (await prisma.session.deleteMany()).count,
  };

  const usersKept = await prisma.user.count();
  console.log("deleted:", deleted);
  console.log(`users kept (untouched): ${usersKept}`);
  console.log("reset-data complete — user accounts were NOT touched");
}

main()
  .catch((e) => {
    console.error("reset-data failed:", e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
