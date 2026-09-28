import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { IdeasBoard, type IdeaSummary } from "@/components/ideas/IdeasBoard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function IdeasPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const highlightParam = params.highlight;
  const highlightId =
    typeof highlightParam === "string" ? highlightParam : undefined;

  const rows = await prisma.idea.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const ideas: IdeaSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return <IdeasBoard ideas={ideas} highlightId={highlightId} />;
}
