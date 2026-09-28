"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SendHorizontal, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { captureQuick } from "@/actions/capture";

/** One-line capture on the Today page — lands in the inbox as UNKNOWN. */
export function InlineCapture() {
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function submit() {
    const content = value.trim();
    if (!content || saving) return;
    setSaving(true);
    const res = await captureQuick({ content });
    setSaving(false);
    if (res.ok) {
      setValue("");
      setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What's on your mind?"
          aria-label="Quick capture — what's on your mind?"
          maxLength={10_000}
        />
        <Button
          type="submit"
          variant="secondary"
          size="icon"
          disabled={!value.trim() || saving}
          aria-label="Capture to inbox"
        >
          <SendHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </form>
      <AnimatePresence>
        {saved && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary"
          >
            <Check className="size-3.5 text-accent" aria-hidden="true" />
            Captured — it&apos;ll be in your inbox when you&apos;re ready.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
