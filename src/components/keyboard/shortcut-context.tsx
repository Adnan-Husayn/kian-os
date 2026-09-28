"use client";

import * as React from "react";

interface ShortcutState {
  captureOpen: boolean;
  searchOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  /** Open capture and close search (they are mutually exclusive). */
  openCapture: () => void;
  /** Open search and close capture. */
  openSearch: () => void;
  /** New-task dialog state (toggled with the "N" shortcut). */
  newTaskOpen: boolean;
  setNewTaskOpen: (open: boolean) => void;
}

const ShortcutContext = React.createContext<ShortcutState | null>(null);

/**
 * Owns the global quick-capture / search modal state. Mounted in the
 * authenticated layout; any child (sidebar, mobile nav, buttons) can open
 * the modals via `useShortcuts()`.
 */
export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [newTaskOpen, setNewTaskOpen] = React.useState(false);

  const value = React.useMemo<ShortcutState>(
    () => ({
      captureOpen,
      searchOpen,
      setCaptureOpen,
      setSearchOpen,
      openCapture: () => {
        setSearchOpen(false);
        setCaptureOpen(true);
      },
      openSearch: () => {
        setCaptureOpen(false);
        setSearchOpen(true);
      },
      newTaskOpen,
      setNewTaskOpen,
    }),
    [captureOpen, searchOpen, newTaskOpen],
  );

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  );
}

export function useShortcuts(): ShortcutState {
  const ctx = React.useContext(ShortcutContext);
  if (!ctx) throw new Error("useShortcuts must be used within ShortcutProvider");
  return ctx;
}
