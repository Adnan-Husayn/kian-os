"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Inbox, Plus, ListTodo, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { PRIMARY_NAV } from "@/components/layout/Sidebar";
import { useShortcuts } from "@/components/keyboard/shortcut-context";
import { LogoutButton } from "@/components/layout/LogoutButton";

const TAB_ITEMS = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
] as const;

const MORE_CANDIDATES = PRIMARY_NAV.filter(
  (item) => !TAB_ITEMS.some((t) => t.href === item.href) && item.href !== "/tasks",
);

/**
 * Mobile bottom navigation: Today, Inbox, center Quick Capture button,
 * Tasks, and a "More" sheet with the remaining links.
 */
export function MobileNav({ username }: { username: string }) {
  const pathname = usePathname();
  const { openCapture, openSearch } = useShortcuts();
  const [moreOpen, setMoreOpen] = React.useState(false);

  function tabClass(href: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return cn(
      "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors duration-150",
      active ? "font-medium text-accent" : "text-text-secondary",
    );
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden"
      >
        <div className="flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={tabClass(item.href)}>
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}

          <div className="flex flex-1 flex-col items-center justify-center">
            <button
              type="button"
              onClick={openCapture}
              aria-label="Quick capture"
              className="flex size-11 items-center justify-center rounded-full bg-accent text-white shadow-md transition-transform duration-150 active:scale-95"
            >
              <Plus className="size-5" />
            </button>
          </div>

          <Link href="/tasks" className={tabClass("/tasks")}>
            <ListTodo className="size-5" />
            Tasks
          </Link>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={tabClass("/more")}
            aria-label="More navigation options"
            aria-haspopup="dialog"
          >
            <Menu className="size-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        label="More navigation"
        side="bottom"
      >
        <div className="pb-6">
          <h2 className="mb-3 text-base font-semibold">More</h2>
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              openSearch();
            }}
            className="mb-2 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-text-secondary hover:bg-accent-soft/50 hover:text-text"
          >
            <Search className="size-4 shrink-0" />
            Search
          </button>
          <Separator className="my-2" />
          <ul className="space-y-0.5">
            {MORE_CANDIDATES.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                      active
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-text-secondary hover:text-text",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Separator className="my-3" />
          <div className="flex items-center justify-between px-3">
            <span className="text-sm text-text-secondary">{username}</span>
            <LogoutButton variant="ghost" size="sm" />
          </div>
        </div>
      </Sheet>
    </>
  );
}
