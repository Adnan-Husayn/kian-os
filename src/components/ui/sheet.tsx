"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  label: string;
  side?: "right" | "bottom";
  className?: string;
}

/** Slide-over panel, used for mobile navigation and side drawers. */
export function Sheet({
  open,
  onOpenChange,
  children,
  label,
  side = "right",
  className,
}: SheetProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  const isBottom = side === "bottom";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/40"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={cn(
              "absolute bg-surface text-text shadow-xl",
              isBottom
                ? "inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl border-t border-border p-5"
                : "inset-y-0 right-0 w-80 max-w-[85vw] border-l border-border p-5",
              className,
            )}
            initial={isBottom ? { y: "100%" } : { x: "100%" }}
            animate={isBottom ? { y: 0 } : { x: 0 }}
            exit={isBottom ? { y: "100%" } : { x: "100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-text-secondary hover:bg-accent-soft hover:text-text"
            >
              <X className="size-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
