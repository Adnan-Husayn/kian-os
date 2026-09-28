import { FolderKanban } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ProjectCard, type ProjectCardData } from "@/components/projects/ProjectCard";
import { NewProjectButton } from "@/components/projects/NewProjectButton";
import { EmptyState } from "@/components/layout/EmptyState";

export const dynamic = "force-dynamic";

const STATUS_ORDER = { ACTIVE: 0, PAUSED: 1, COMPLETED: 2, ARCHIVED: 3 } as const;

/**
 * /projects — grid of project cards with progress, counts and status.
 */
export default async function ProjectsPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      status: true,
      updatedAt: true,
      tasks: {
        where: { parentTaskId: null },
        select: { status: true },
      },
    },
  });

  const cards: ProjectCardData[] = projects
    .map((p) => ({
      card: {
        id: p.id,
        name: p.name,
        description: p.description,
        color: p.color,
        status: p.status,
        total: p.tasks.length,
        done: p.tasks.filter((t) => t.status === "DONE").length,
      } satisfies ProjectCardData,
      sortKey: p.updatedAt.getTime(),
      statusRank: STATUS_ORDER[p.status],
    }))
    .sort((a, b) => a.statusRank - b.statusRank || b.sortKey - a.sortKey)
    .map(({ card }) => card);

  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Projects
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {activeCount} active project{activeCount === 1 ? "" : "s"}
          </p>
        </div>
        <NewProjectButton />
      </header>

      {cards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Group related tasks and notes under a project to keep bigger efforts moving."
        />
      )}
    </div>
  );
}
