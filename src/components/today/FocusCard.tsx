"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Crosshair, Pencil, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateDailyPlan } from "@/actions/planner";

interface FocusCardProps {
  dayKey: string;
  initialFocus: string | null;
}

/** Big calm focus card with inline editing. */
export function FocusCard({ dayKey, initialFocus }: FocusCardProps) {
  const [focus, setFocus] = React.useState(initialFocus ?? "");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(initialFocus ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const trimmed = draft.trim();
    setSaving(true);
    const res = await updateDailyPlan({ dayKey, mainFocus: trimmed || null });
    setSaving(false);
    if (res.ok) {
      setFocus(trimmed);
      setEditing(false);
    }
  }

  return (
    <motion.section
      aria-label="Today's focus"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-secondary">
            <Crosshair className="size-3.5" aria-hidden="true" />
            Today&apos;s focus
          </div>
          {editing ? (
            <div className="mt-3 flex flex-col gap-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                  if (e.key === "Escape") {
                    setDraft(focus);
                    setEditing(false);
                  }
                }}
                placeholder="What's the one thing that matters today?"
                aria-label="Today's focus"
                maxLength={500}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void save()} disabled={saving}>
                  <Check className="size-3.5" aria-hidden="true" />
                  {saving ? "Saving…" : "Save focus"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(focus);
                    setEditing(false);
                  }}
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-start justify-between gap-4">
              <p className="text-xl font-semibold leading-snug tracking-tight md:text-2xl">
                {focus ? (
                  focus
                ) : (
                  <span className="font-normal text-text-secondary">
                    No focus set yet — pick one thing that matters.
                  </span>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(focus);
                  setEditing(true);
                }}
                aria-label={focus ? "Change focus" : "Set focus"}
                className="shrink-0"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                {focus ? "Change focus" : "Set focus"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.section>
  );
}
