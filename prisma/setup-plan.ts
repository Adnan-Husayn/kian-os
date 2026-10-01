/**
 * One-time personal setup (October 2026): projects, daily routines and a few
 * starter tasks. IDEMPOTENT: projects are matched by name, routines and tasks
 * by title, so running it twice adds nothing the second time. It never
 * deletes anything.
 *
 * Usage: DATABASE_URL="<connection string>" npm run db:setup-plan
 *        (uses SEED_USERNAME, default "kian", to find the account)
 */
import { prisma } from "../src/lib/db";
import { addDaysKolkata, kolkataDateFromDayKey, todayKolkata } from "../src/lib/dates";

const USERNAME = process.env.SEED_USERNAME ?? "kian";

const PROJECTS = [
  { key: "dsa", name: "Interview prep (DSA)", color: "#2f4a9e" },
  // Reuses the starter project of the same name when it exists.
  { key: "saa", name: "AWS SAA Preparation", color: "#ef4444" },
  { key: "farsi", name: "Farsi", color: "#0f766e" },
  { key: "builds", name: "Builds", color: "#7c3aed" },
  { key: "hackathons", name: "Hackathons", color: "#f59e0b" },
  { key: "fitness", name: "Fitness", color: "#16a34a" },
  { key: "admin", name: "Life admin", color: "#64748b" },
] as const;

type ProjectKey = (typeof PROJECTS)[number]["key"];

/** Minutes: [college day, free day]; null = skip that kind of day. */
const ROUTINES: Array<{
  title: string;
  project: ProjectKey;
  college: number | null;
  free: number | null;
  startTime?: string;
  weekdays?: number[];
}> = [
  { title: "DSA practice", project: "dsa", college: 60, free: 90 },
  { title: "SAA exam prep", project: "saa", college: 45, free: 90 },
  { title: "Farsi practice", project: "farsi", college: 20, free: 30 },
  { title: "Gym", project: "fitness", college: 60, free: 60, startTime: "20:00" },
  { title: "Build time", project: "builds", college: 45, free: 120 },
  // Sunday only, free days only.
  { title: "Laundry", project: "admin", college: null, free: 45, weekdays: [7] },
];

const today = todayKolkata();
const inDays = (n: number) => addDaysKolkata(today, n);

const TASKS: Array<{
  title: string;
  project: ProjectKey;
  minutes: number;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: Date;
  scheduledDate?: Date;
}> = [
  {
    title: "Book the AWS SAA exam date",
    project: "saa",
    minutes: 20,
    priority: "HIGH",
    dueDate: inDays(7),
  },
  {
    title: "Choose an SAA course and a practice-exam set",
    project: "saa",
    minutes: 30,
    dueDate: inDays(3),
  },
  {
    title: "Pick a DSA problem list to follow",
    project: "dsa",
    minutes: 20,
    dueDate: inDays(2),
  },
  {
    title: "Pick a Farsi course or textbook to follow",
    project: "farsi",
    minutes: 20,
    dueDate: inDays(3),
  },
  {
    title: "Decide the next project to build",
    project: "builds",
    minutes: 30,
    priority: "HIGH",
    dueDate: inDays(3),
  },
  {
    title: "Check the hackathon result",
    project: "hackathons",
    minutes: 10,
    dueDate: kolkataDateFromDayKey("2026-10-04"),
  },
  {
    title: "Find and register for the next hackathon",
    project: "hackathons",
    minutes: 30,
    dueDate: inDays(9),
  },
  {
    title: "Rejoin the gym: sort out membership",
    project: "fitness",
    minutes: 15,
    scheduledDate: inDays(1),
  },
];

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: USERNAME },
    select: { id: true },
  });
  if (!user) {
    throw new Error(`No user "${USERNAME}". Set SEED_USERNAME to your username.`);
  }
  const userId = user.id;

  // Projects: reuse by name, create the rest.
  const projectIds = {} as Record<ProjectKey, string>;
  for (const p of PROJECTS) {
    const existing = await prisma.project.findFirst({
      where: { userId, name: p.name },
      select: { id: true },
    });
    const row =
      existing ??
      (await prisma.project.create({
        data: { userId, name: p.name, color: p.color },
        select: { id: true },
      }));
    projectIds[p.key] = row.id;
    console.log(`${existing ? "kept   " : "created"} project  ${p.name}`);
  }

  // Routines: skip any whose title already exists.
  const existingRoutines = await prisma.routine.findMany({
    where: { userId },
    select: { title: true, position: true },
  });
  const routineTitles = new Set(existingRoutines.map((r) => r.title));
  let position =
    existingRoutines.reduce((max, r) => Math.max(max, r.position), -1) + 1;
  for (const r of ROUTINES) {
    if (routineTitles.has(r.title)) {
      console.log(`kept    routine  ${r.title}`);
      continue;
    }
    await prisma.routine.create({
      data: {
        userId,
        title: r.title,
        projectId: projectIds[r.project],
        minutesCollege: r.college,
        minutesFree: r.free,
        startTime: r.startTime ?? null,
        weekdays: r.weekdays ?? [],
        position: position++,
      },
    });
    console.log(`created routine  ${r.title}`);
  }

  // Tasks: skip any whose title already exists.
  for (const t of TASKS) {
    const existing = await prisma.task.findFirst({
      where: { userId, title: t.title },
      select: { id: true },
    });
    if (existing) {
      console.log(`kept    task     ${t.title}`);
      continue;
    }
    await prisma.task.create({
      data: {
        userId,
        title: t.title,
        projectId: projectIds[t.project],
        estimatedMinutes: t.minutes,
        priority: t.priority ?? "MEDIUM",
        dueDate: t.dueDate ?? null,
        scheduledDate: t.scheduledDate ?? null,
      },
    });
    console.log(`created task     ${t.title}`);
  }

  console.log("setup complete");
}

main()
  .catch((e) => {
    console.error("setup failed:", e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
