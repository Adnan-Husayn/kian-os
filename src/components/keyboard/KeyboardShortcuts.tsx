"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { QuickCaptureModal } from "@/components/capture/QuickCaptureModal";
import { SearchModal } from "@/components/search/SearchModal";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { useShortcuts } from "@/components/keyboard/shortcut-context";

/**
 * Global keyboard shortcuts for authenticated pages:
 * - Cmd/Ctrl+K — quick capture
 * - Cmd/Ctrl+/ — search
 * - N — new task dialog (when not typing)
 * - T — go to /today (when not typing)
 * - J — go to /journal (when not typing)
 * - I — new idea dialog, handled on the /ideas page itself
 * - Esc — handled by the modals themselves
 *
 * Rendered once in the authenticated (app) layout; modal open-state lives in
 * ShortcutProvider so sidebar / mobile-nav buttons can trigger them too.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const {
    captureOpen,
    searchOpen,
    setCaptureOpen,
    setSearchOpen,
    newTaskOpen,
    setNewTaskOpen,
  } = useShortcuts();

  React.useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(false);
        setCaptureOpen(!captureOpen);
        return;
      }
      if (mod && e.key === "/") {
        e.preventDefault();
        setCaptureOpen(false);
        setSearchOpen(!searchOpen);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (mod || e.altKey) return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCaptureOpen(false);
        setSearchOpen(false);
        setNewTaskOpen(true);
        return;
      }

      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setCaptureOpen(false);
        setSearchOpen(false);
        router.push("/today");
        return;
      }

      if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        setCaptureOpen(false);
        setSearchOpen(false);
        router.push("/journal");
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    router,
    captureOpen,
    searchOpen,
    setCaptureOpen,
    setSearchOpen,
    setNewTaskOpen,
  ]);

  return (
    <>
      <QuickCaptureModal open={captureOpen} onOpenChange={setCaptureOpen} />
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </>
  );
}
