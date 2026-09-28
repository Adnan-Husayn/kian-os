import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { IdeaDetail, type IdeaDetailData } from "@/components/ideas/IdeaDetail";

export const dynamic = "force-dynamic";

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const row = await prisma.idea.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      status: true,
      why: true,
      couldBecome: true,
      nextAction: true,
    },
  });

  if (!row) notFound();

  const idea: IdeaDetailData = {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    status: row.status,
    why: row.why,
    couldBecome: row.couldBecome,
    nextAction: row.nextAction,
  };

  return <IdeaDetail idea={idea} />;
}
