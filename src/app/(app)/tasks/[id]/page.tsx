import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TaskDetailView } from "@/components/tasks/TaskDetailView";

export const dynamic = "force-dynamic";

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * /tasks/[id] — deep-linkable task detail: editable fields, subtask
 * checklist, reschedule / let-go / delete actions.
 */
export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  // Both reads run in parallel: each is a round trip to the database.
  const [task, projects] = await Promise.all([
    prisma.task.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        scheduledDate: true,
        scheduledStartTime: true,
        scheduledEndTime: true,
        estimatedMinutes: true,
        actualMinutes: true,
        createdAt: true,
        project: { select: { id: true, name: true, color: true } },
        subtasks: {
          select: { id: true, title: true, status: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { subtasks: true } },
      },
    }),
    prisma.project.findMany({
      where: { userId: user.id, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!task) notFound();

  return <TaskDetailView task={task} projects={projects} />;
}
