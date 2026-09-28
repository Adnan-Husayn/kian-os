import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ProjectStatus } from "@prisma/client";

export interface ProjectCardData {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: ProjectStatus;
  total: number;
  done: number;
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

/**
 * Project card for the /projects grid: color accent, name, description,
 * progress bar (DONE / total tasks) and status badge.
 */
export function ProjectCard({ project }: { project: ProjectCardData }) {
  const color = project.color ?? "#6366f1";
  const percent = project.total === 0 ? 0 : Math.round((project.done / project.total) * 100);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-xl transition-transform duration-150 hover:-translate-y-0.5"
      aria-label={`Open project ${project.name}`}
    >
      <Card className="h-full overflow-hidden">
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <span
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}1a`, color }}
              aria-hidden="true"
            >
              <FolderKanban className="size-5" />
            </span>
            <Badge variant={project.status === "ACTIVE" ? "default" : "secondary"}>
              {STATUS_LABEL[project.status]}
            </Badge>
          </div>
          <h2 className="mt-3 text-base font-semibold text-text">{project.name}</h2>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
              {project.description}
            </p>
          )}
          <div className="mt-4">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${percent}% of tasks done`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{ width: `${percent}%`, backgroundColor: color }}
              />
            </div>
            <p className="mt-1.5 text-xs text-text-secondary">
              {project.done} of {project.total} tasks done
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
