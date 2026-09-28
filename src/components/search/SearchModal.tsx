"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Zap,
  FolderKanban,
  Lightbulb,
  StickyNote,
  BookOpen,
  Loader2,
} from "lucide-react";
import { searchAll, type SearchResults, type SearchHit } from "@/actions/search";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GROUPS: {
  key: keyof SearchResults;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "tasks", label: "Tasks", icon: Zap },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "ideas", label: "Ideas", icon: Lightbulb },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "journalEntries", label: "Journal", icon: BookOpen },
];

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Global search palette (Cmd/Ctrl+/). Debounced input, grouped results
 * (tasks / projects / ideas / notes) via the `searchAll` server action.
 */
export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults | null>(null);
  // The query the currently-displayed results were searched for. Loading is
  // derived (never setState'd in the effect): the modal is "loading" when
  // there is a non-empty query whose search hasn't resolved yet.
  const [searchedQuery, setSearchedQuery] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const debouncedQuery = useDebouncedValue(query, 200);
  const trimmedQuery = debouncedQuery.trim();
  // When the query is empty the modal shows its empty state. The visible
  // results/loading are DERIVED during render (not reset with setState in
  // the effect below), so the search effect never calls setState
  // synchronously.
  const visibleResults = trimmedQuery.length === 0 ? null : results;
  const visibleLoading =
    trimmedQuery.length > 0 && searchedQuery !== trimmedQuery;

  const close = React.useCallback(() => {
    onOpenChange(false);
    window.setTimeout(() => {
      setQuery("");
      setResults(null);
      setActiveIndex(0);
    }, 250);
  }, [onOpenChange]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  React.useEffect(() => {
    if (!open) return;
    const q = trimmedQuery;
    if (q.length === 0) return;
    let cancelled = false;
    searchAll(q)
      .then((r) => {
        if (!cancelled) {
          setResults(r);
          setActiveIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setSearchedQuery(q);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmedQuery, open]);

  const flatHits: { hit: SearchHit; groupLabel: string }[] = React.useMemo(() => {
    if (!visibleResults) return [];
    const out: { hit: SearchHit; groupLabel: string }[] = [];
    for (const g of GROUPS) {
      for (const hit of visibleResults[g.key]) out.push({ hit, groupLabel: g.label });
    }
    return out;
  }, [visibleResults]);

  const totalCount = flatHits.length;

  // Global result index where each non-empty group starts (for keyboard nav).
  const groupOffsets = React.useMemo(() => {
    const map = new Map<string, number>();
    let offset = 0;
    for (const g of GROUPS) {
      map.set(g.key, offset);
      offset += visibleResults?.[g.key]?.length ?? 0;
    }
    return map;
  }, [visibleResults]);

  function onResultKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatHits[activeIndex]) {
      window.location.href = flatHits[activeIndex].hit.href;
    }
  }

  return open ? (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        initial={{ opacity: 0, scale: 0.98, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          {visibleLoading ? (
            <Loader2 className="size-4 animate-spin text-text-secondary" />
          ) : (
            <Search className="size-4 text-text-secondary" />
          )}
          <label htmlFor="global-search-input" className="sr-only">
            Search tasks, projects, ideas, notes and journal
          </label>
          <Input
            id="global-search-input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onResultKeyDown}
            placeholder="Search tasks, projects, ideas, notes, journal…"
            className="h-12 border-0 bg-transparent px-0 text-base shadow-none"
          />
          <Badge variant="outline" className="shrink-0 font-mono">
            Esc
          </Badge>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2" role="listbox" aria-label="Search results">
          {trimmedQuery.length > 0 && !visibleLoading && totalCount === 0 && (
            <p className="px-3 py-8 text-center text-sm text-text-secondary">
              No results for “{trimmedQuery}”.
            </p>
          )}
          {GROUPS.map((group) => {
            const hits = visibleResults?.[group.key] ?? [];
            if (hits.length === 0) return null;
            const Icon = group.icon;
            return (
              <div key={group.key} className="mb-1">
                <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                  <Icon className="size-3.5" />
                  {group.label}
                </p>
                {hits.map((hit, i) => {
                  const idx = (groupOffsets.get(group.key) ?? 0) + i;
                  const active = idx === activeIndex;
                  return (
                    <Link
                      key={hit.id}
                      href={hit.href}
                      role="option"
                      aria-selected={active}
                      onClick={close}
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                        active ? "bg-accent-soft text-text" : "text-text",
                      )}
                    >
                      <span className="truncate">{hit.title}</span>
                      {hit.subtitle && (
                        <span className="ml-3 shrink-0 text-xs capitalize text-text-secondary">
                          {hit.subtitle}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  ) : null;
}
