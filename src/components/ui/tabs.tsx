"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { id: string; label: string }[];
  value: string;
  onValueChange: (id: string) => void;
  label: string;
  className?: string;
}

/** Simple tab strip with proper tablist semantics. */
export function Tabs({ tabs, value, onValueChange, label, className }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-bg p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onValueChange(tab.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              selected
                ? "bg-surface text-text shadow-sm"
                : "text-text-secondary hover:text-text",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
