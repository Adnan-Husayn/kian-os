"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sunrise, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateDailyPlan } from "@/actions/planner";
import { useShortcuts } from "@/components/keyboard/shortcut-context";

interface FirstDayProps {
  dayKey: string;
}

/**
 * First-run experience: no plan exists yet, so keep it to one question —
 * the ONE thing that would make today feel worthwhile.
 */
export function FirstDay({ dayKey }: FirstDayProps) {
  const [focus, setFocus] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const router = useRouter();
  const { openCapture } = useShortcuts();

  async function saveFocus() {
    const trimmed = focus.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const res = await updateDailyPlan({ dayKey, mainFocus: trimmed });
    setSaving(false);
    if (res.ok) router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex min-h-[55vh] items-center justify-center"
    >
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <span className="mb-5 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Sunrise className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold tracking-tight">
            You don&apos;t have a plan for today.
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Let&apos;s keep it simple. What&apos;s the{" "}
            <span className="font-medium text-text">one thing</span> that would
            make today feel worthwhile?
          </p>
          <form
            className="mt-6 flex w-full flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void saveFocus();
            }}
          >
            <Input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="The one thing…"
              aria-label="The one thing that would make today feel worthwhile"
              maxLength={500}
              autoFocus
            />
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                disabled={!focus.trim() || saving}
                className="flex-1"
              >
                {saving ? "Saving…" : "Set today's focus"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={openCapture}
                className="flex-1"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add a task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
