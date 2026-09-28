import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import {
  NoteEditor,
  type NoteDetailData,
  type ProjectOption,
} from "@/components/notes/NoteEditor";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [row, projects] = await Promise.all([
    prisma.note.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        pinned: true,
        projectId: true,
      },
    }),
    prisma.project.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!row) notFound();

  const note: NoteDetailData = {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags,
    pinned: row.pinned,
    projectId: row.projectId,
  };

  const projectOptions: ProjectOption[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return <NoteEditor note={note} projects={projectOptions} />;
}
