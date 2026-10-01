import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { listRoutines } from "@/actions/routines";
import { dayKeyKolkata } from "@/lib/dates";
import { RoutinesManager } from "@/components/routines/RoutinesManager";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const user = await requireUser();
  const [routines, projects] = await Promise.all([
    listRoutines(dayKeyKolkata()),
    prisma.project.findMany({
      where: { userId: user.id, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <RoutinesManager routines={routines} projects={projects} />;
}
