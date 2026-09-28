"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { dayKeyKolkata, formatDay } from "@/lib/dates";

export interface SearchHit {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export interface SearchResults {
  tasks: SearchHit[];
  projects: SearchHit[];
  ideas: SearchHit[];
  notes: SearchHit[];
  journalEntries: SearchHit[];
}

const EMPTY: SearchResults = {
  tasks: [],
  projects: [],
  ideas: [],
  notes: [],
  journalEntries: [],
};

const MAX_QUERY_LENGTH = 100;
const HITS_PER_TYPE = 8;

/**
 * Cross-entity search for the Cmd/Ctrl+/ palette.
 *
 * TODO: replace the ILIKE `contains` filters with Postgres full-text search
 * (tsvector + GIN index, `websearch_to_tsquery`) once the corpus grows or
 * ranking matters. The result shape is already grouped per entity, so the
 * swap is internal to this function.
 */
export async function searchAll(query: string): Promise<SearchResults> {
  const user = await requireUser();
  const q = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length === 0) return EMPTY;

  // Case-insensitive substring match. Read-only action — no CSRF check needed.
  const [tasks, projects, ideas, notes, journalEntries] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: HITS_PER_TYPE,
    }),
    prisma.project.findMany({
      where: {
        userId: user.id,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: HITS_PER_TYPE,
    }),
    prisma.idea.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: HITS_PER_TYPE,
    }),
    prisma.note.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, pinned: true },
      orderBy: { updatedAt: "desc" },
      take: HITS_PER_TYPE,
    }),
    prisma.journalEntry.findMany({
      where: {
        userId: user.id,
        content: { contains: q, mode: "insensitive" },
      },
      select: { id: true, date: true, content: true },
      orderBy: { date: "desc" },
      take: HITS_PER_TYPE,
    }),
  ]);

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.status.replace(/_/g, " ").toLowerCase(),
      href: `/tasks?highlight=${t.id}`,
    })),
    projects: projects.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: p.status.toLowerCase(),
      href: `/projects?highlight=${p.id}`,
    })),
    ideas: ideas.map((i) => ({
      id: i.id,
      title: i.title,
      subtitle: i.status.replace(/_/g, " ").toLowerCase(),
      href: `/ideas?highlight=${i.id}`,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      subtitle: n.pinned ? "pinned" : undefined,
      href: `/notes?highlight=${n.id}`,
    })),
    journalEntries: journalEntries.map((j) => {
      const excerpt = (j.content ?? "").replace(/\s+/g, " ").trim();
      return {
        id: j.id,
        title:
          excerpt.length > 72 ? `${excerpt.slice(0, 72).trimEnd()}…` : excerpt || "Journal entry",
        subtitle: formatDay(j.date),
        href: `/journal?date=${dayKeyKolkata(j.date)}`,
      };
    }),
  };
}
