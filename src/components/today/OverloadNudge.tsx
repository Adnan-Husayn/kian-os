"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Clock, X, ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OverloadNudgeProps {
  plannedMinutes: number;
  thresholdMinutes: number;
}

/**
 * Gentle, dismissible nudge when the day is over-planned. Calm colors only —
 * information, never alarm.
 */
export function OverloadNudge({
  plannedMinutes,
  thresholdMinutes,
}: OverloadNudgeProps) {
  const [dismissed, setDismissed] = React.useState(false);
  const show = !dismissed && plannedMinutes > thresholdMinutes;
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        role="note"
        aria-label="Day looks full"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex items-start gap-3 rounded-lg border border-border bg-accent-soft/60 px-4 py-3"
      >
        <Clock
          className="mt-0.5 size-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text">
            You&apos;ve planned quite a lot today. You could move a couple of
            tasks to another day.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/plan"
              className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
            >
              Review plan
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded-md p-1 text-text-secondary hover:text-text"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
