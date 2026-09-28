import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";

export const dynamic = "force-dynamic";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * /projects/[id] — header with goal/description, NEXT ACTION card, inline
 * task add + task list, linked notes, status control and delete.
 */
export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      status: true,
    },
  });

  if (!project) notFound();

  const [tasks, notes] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, projectId: project.id, parentTaskId: null },
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
    prisma.note.findMany({
      where: { userId: user.id, projectId: project.id },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  const done = tasks.filter((t) => t.status === "DONE").length;
  const progress = {
    total: tasks.length,
    done,
    percent: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
  };

  return (
    <ProjectDetailView
      project={project}
      tasks={tasks}
      progress={progress}
      notes={notes}
    />
  );
}
