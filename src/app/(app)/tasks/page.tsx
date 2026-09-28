import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TasksList } from "@/components/tasks/TaskList";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/**
 * /tasks — filterable task list (chips, project + status filters) with
 * deep-linkable rows to /tasks/[id]. "N" opens the new-task dialog.
 */
export default async function TasksPage() {
  const user = await requireUser();

  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, parentTaskId: null },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        scheduledDate: true,
        scheduledStartTime: true,
        scheduledEndTime: true,
        estimatedMinutes: true,
        createdAt: true,
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { subtasks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({
      where: { userId: user.id, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const openCount = tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "CANCELLED",
  ).length;

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {openCount} open ·{" "}
            <Badge variant="outline" className="font-mono">
              N
            </Badge>{" "}
            for a new task
          </p>
        </div>
      </header>
      <TasksList tasks={tasks} projects={projects} />
    </div>
  );
}
