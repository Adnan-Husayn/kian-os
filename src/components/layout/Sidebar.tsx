"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  CalendarCheck,
  Inbox,
  ListTodo,
  FolderKanban,
  Lightbulb,
  StickyNote,
  Calendar,
  BookOpen,
  BarChart3,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useShortcuts } from "@/components/keyboard/shortcut-context";
import { LogoutButton } from "@/components/layout/LogoutButton";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/plan", label: "Plan", icon: CalendarCheck },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/review", label: "Review", icon: BarChart3 },
];

/** Desktop sidebar for authenticated pages. */
export function Sidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const { openSearch } = useShortcuts();

  return (
    <aside
      aria-label="Primary navigation"
      className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex"
    >
      <div className="flex h-14 items-center px-5">
        <Link href="/today" className="text-xl italic tracking-tight">
          Kian&nbsp;OS
        </Link>
      </div>
      <Separator />
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                    active
                      ? "font-medium text-text"
                      : "text-text-secondary hover:bg-accent-soft/50 hover:text-text",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                  {active && (
                    <span aria-hidden="true" className="ml-auto font-mono text-lg leading-none text-mark">
                      •
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <Separator className="my-3" />
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-accent-soft/50 hover:text-text"
          aria-label="Search (Control or Command slash)"
        >
          <Search className="size-4 shrink-0" />
          Search
          <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
            ⌃/
          </kbd>
        </button>
        <Separator className="my-3" />
        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
            pathname === "/settings"
              ? "font-medium text-text"
              : "text-text-secondary hover:bg-accent-soft/50 hover:text-text",
          )}
        >
          <Settings className="size-4 shrink-0" />
          Settings
        </Link>
      </nav>
      <Separator />
      <div className="flex items-center justify-between px-5 py-3">
        <span className="truncate text-sm text-text-secondary">{username}</span>
        <LogoutButton variant="ghost" size="sm" />
      </div>
    </aside>
  );
}
