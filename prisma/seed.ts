/**
 * Kian OS seed script. IDEMPOTENT: if a user with SEED_USERNAME already
 * exists, the script prints "seed skipped: user exists" and touches nothing.
 *
 * Usage: npm run db:seed   (reads SEED_USERNAME / SEED_PASSWORD from env)
 */
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { todayKolkata } from "../src/lib/dates";

const SEED_USERNAME = process.env.SEED_USERNAME ?? "kian";
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "kianamna";

async function main() {
  const existing = await prisma.user.findUnique({
    where: { username: SEED_USERNAME },
    select: { id: true },
  });
  if (existing) {
    console.log("seed skipped: user exists");
    return;
  }

  const user = await prisma.user.create({
    data: {
      username: SEED_USERNAME,
      passwordHash: await hashPassword(SEED_PASSWORD),
    },
  });
  console.log(`created user "${SEED_USERNAME}"`);

  const projectNames = [
    { name: "Market Making Simulator", color: "#6366f1" },
    { name: "CHIP-8 Emulator", color: "#0ea5e9" },
    { name: "LocalCrunch", color: "#10b981" },
    { name: "Final Year Project", color: "#f59e0b" },
    { name: "AWS SAA Preparation", color: "#ef4444" },
  ];
  const projects = await Promise.all(
    projectNames.map((p) =>
      prisma.project.create({
        data: { userId: user.id, name: p.name, color: p.color },
        select: { id: true, name: true },
      }),
    ),
  );
  const projectId = (name: string) =>
    projects.find((p) => p.name === name)?.id ?? null;
  console.log(`created ${projects.length} projects`);

  const taskSeeds: {
    title: string;
    project: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH";
    status?: "INBOX" | "TODO";
  }[] = [
    {
      title: "Implement reservation price",
      project: "Market Making Simulator",
      priority: "HIGH",
    },
    {
      title: "Review Gueant paper",
      project: "Market Making Simulator",
      priority: "MEDIUM",
    },
    {
      title: "Implement CHIP-8 sound",
      project: "CHIP-8 Emulator",
      priority: "MEDIUM",
    },
    {
      title: "Finish AWS networking revision",
      project: "AWS SAA Preparation",
      priority: "HIGH",
    },
    {
      title: "Work on final year project",
      project: "Final Year Project",
      priority: "MEDIUM",
    },
  ];
  await Promise.all(
    taskSeeds.map((t) =>
      prisma.task.create({
        data: {
          userId: user.id,
          title: t.title,
          priority: t.priority,
          projectId: t.project ? projectId(t.project) : null,
        },
      }),
    ),
  );
  console.log(`created ${taskSeeds.length} tasks`);

  const ideaSeeds = [
    {
      title: "Rust order book visualizer",
      content: "Real-time L2 book rendering with order-flow overlays.",
      category: "Quant",
    },
    {
      title: "Browser-based quant research notebook",
      content: "Notebooks that run backtests against local tick data in the browser.",
      category: "Quant",
    },
    {
      title: "Collaborative trading simulator",
      content: "Multiplayer paper-trading arena with shared market replay.",
      category: "Quant",
    },
  ];
  await Promise.all(
    ideaSeeds.map((i) =>
      prisma.idea.create({
        data: {
          userId: user.id,
          title: i.title,
          content: i.content,
          category: i.category,
        },
      }),
    ),
  );
  console.log(`created ${ideaSeeds.length} ideas`);

  const captureSeeds = [
    "Look into historical limit order book data feeds",
    "Read the market microstructure reading list",
    "Fix the CHIP-8 FX0A edge case before the next test run",
  ];
  await Promise.all(
    captureSeeds.map((content) =>
      prisma.capture.create({ data: { userId: user.id, content } }),
    ),
  );
  console.log(`created ${captureSeeds.length} captures`);

  const today = todayKolkata();
  await prisma.journalEntry.create({
    data: {
      userId: user.id,
      date: today,
      content: "Seeded entry — Kian OS foundation day. Replace with a real reflection.",
      mood: "good",
      energy: "medium",
    },
  });
  console.log("created journal entry for today");

  await prisma.dailyPlan.create({
    data: {
      userId: user.id,
      date: today,
      mainFocus: "Set up the Kian OS foundation",
      intention: "Ship the foundation calmly, one piece at a time.",
      energyLevel: "medium",
    },
  });
  console.log("created daily plan for today");

  console.log("seed complete");
}

main()
  .catch((e) => {
    console.error("seed failed:", e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
