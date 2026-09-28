"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Frown, Meh, Smile, Laugh, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveJournalEntry } from "@/actions/planner";

type Mood = "low" | "okay" | "good" | "great";
type Energy = "low" | "medium" | "high";

interface JournalEditorProps {
  dayKey: string;
  initialContent: string;
  initialMood: Mood | null;
  initialEnergy: Energy | null;
}

const MOODS: { value: Mood; label: string; icon: typeof Frown }[] = [
  { value: "low", label: "Low", icon: Frown },
  { value: "okay", label: "Okay", icon: Meh },
  { value: "good", label: "Good", icon: Smile },
  { value: "great", label: "Great", icon: Laugh },
];

const ENERGIES: { value: Energy; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const VALID_MOODS: Mood[] = ["low", "okay", "good", "great"];
const VALID_ENERGIES: Energy[] = ["low", "medium", "high"];

/** Lightweight journal editor: big textarea, mood + energy words, save. */
export function JournalEditor({
  dayKey,
  initialContent,
  initialMood,
  initialEnergy,
}: JournalEditorProps) {
  const [content, setContent] = React.useState(initialContent);
  const [mood, setMood] = React.useState<Mood | null>(
    initialMood && VALID_MOODS.includes(initialMood) ? initialMood : null,
  );
  const [energy, setEnergy] = React.useState<Energy | null>(
    initialEnergy && VALID_ENERGIES.includes(initialEnergy)
      ? initialEnergy
      : null,
  );
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    const res = await saveJournalEntry({
      dayKey,
      content,
      mood,
      energy,
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5 md:p-6">
        <div className="space-y-2">
          <Label htmlFor="journal-content">Today I…</Label>
          <Textarea
            id="journal-content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setSaved(false);
            }}
            placeholder="Today I…"
            rows={8}
            maxLength={100_000}
            className="text-base leading-relaxed"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label id="journal-mood-label">Mood</Label>
            <div
              role="group"
              aria-labelledby="journal-mood-label"
              className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-bg p-1"
            >
              {MOODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mood === value}
                  onClick={() => {
                    setMood(value);
                    setSaved(false);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-xs transition-colors duration-150",
                    mood === value
                      ? "bg-surface font-medium text-text shadow-sm"
                      : "text-text-secondary hover:text-text",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label id="journal-energy-label">Energy</Label>
            <div
              role="group"
              aria-labelledby="journal-energy-label"
              className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-bg p-1"
            >
              {ENERGIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={energy === value}
                  onClick={() => {
                    setEnergy(value);
                    setSaved(false);
                  }}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs transition-colors duration-150",
                    energy === value
                      ? "bg-surface font-medium text-text shadow-sm"
                      : "text-text-secondary hover:text-text",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save entry"}
          </Button>
          <AnimatePresence>
            {saved && (
              <motion.p
                role="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1.5 text-sm text-text-secondary"
              >
                <Check className="size-4 text-accent" aria-hidden="true" />
                Saved.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
