import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { NotesList, type NoteSummary } from "@/components/notes/NotesList";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function NotesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const highlightParam = params.highlight;
  const highlightId =
    typeof highlightParam === "string" ? highlightParam : undefined;

  const rows = await prisma.note.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      pinned: true,
      projectId: true,
      project: { select: { name: true } },
      updatedAt: true,
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  const notes: NoteSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    tags: r.tags,
    pinned: r.pinned,
    projectId: r.projectId,
    projectName: r.project?.name ?? null,
    updatedAt: r.updatedAt,
  }));

  return <NotesList notes={notes} highlightId={highlightId} />;
}
